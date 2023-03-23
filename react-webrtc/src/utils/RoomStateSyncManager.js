import {
  BehaviorSubject,
  defer,
  EMPTY,
  filter,
  from,
  map,
  merge,
  mergeMap,
  ReplaySubject,
  share,
  shareReplay,
  Subject,
  take,
  tap,
  zipWith,
} from "rxjs";
import { Record, Set, List } from "immutable";
import { getRoomSnapshot, getRoomDeltas } from "./Api";
import Logger from "./Logger";

const Snapshot = Record({
  roomId: "",
  seq: -1,
  clientIds: Set(),
});

const Delta = Record({
  type: "",
  seq: -1,
  clientId: "",
});

export default class RoomStateSyncManager {
  subscriptions = [];

  constructor(roomId, wsObservable) {
    this.logger = new Logger("RoomStateSyncManager");
    this.logger.log("constructor()");

    this.roomId = roomId;
    this.wsObservable = wsObservable;

    // === Deltas ===

    const rawDeltasSubject = new Subject();
    const deltaListsSubject = new BehaviorSubject(List());
    const snapshotsSubject = new ReplaySubject(1);

    const deltasObservable = rawDeltasSubject.pipe(
      map((data) => Delta(data)),
      tap((delta) => this.logger.debug("new delta", delta.toJS())),
      share()
    );

    let isFetchingGapDeltas = false;

    this.subscriptions.push(
      // --- Fetch initial snapshot ---
      defer(() => from(getRoomSnapshot(this.roomId)))
        .pipe(
          map((data) =>
            Snapshot({
              roomId: this.roomId,
              seq: data.seq,
              clientIds: Set(data.clientIds),
            })
          ),
          tap((snapshot) => this.logger.debug("new snapshot", snapshot.toJS()))
        )
        .subscribe((snapshot) =>
          // Not directly subscribing snapshotsSubject, so we don't complete
          // the snapshotsSubject when this observable complete.
          snapshotsSubject.next(snapshot)
        ),
      // --- Subscribe to deltas from WebSocket API ---
      this.wsObservable
        .pipe(
          filter((message) => message.isDelta),
          tap((delta) => this.logger.debug("new detla from ws", delta))
        )
        .subscribe(rawDeltasSubject),
      // --- Accumulate delta to deltaListSubject ---
      deltasObservable.subscribe((delta) =>
        deltaListsSubject.next(deltaListsSubject.getValue().push(delta))
      ),
      // --- Apply delta to snapshot ---
      merge(snapshotsSubject, deltasObservable)
        .pipe(
          mergeMap(() => snapshotsSubject.pipe(take(1))),
          map((snapshot) => {
            return [
              // TODO: Making sure there isn't any duplicates
              deltaListsSubject
                .getValue()
                .sortBy((d) => d.seq)
                .filter((d) => d.seq > snapshot.seq),
              snapshot,
            ];
          }),
          tap(([deltas, snapshot]) => {
            const snapshotStr = JSON.stringify(snapshot.toJS(), null, 4);
            const deltasStr = JSON.stringify(deltas.toJS(), null, 4);
            this.logger.debug(
              `[1] snapshot = ${snapshotStr}\ndeltas = ${deltasStr}`
            );
          }),
          mergeMap(([deltas, snapshot]) => {
            if (deltas.size === 0) {
              this.logger.log("deltas.size === 0");
              deltaListsSubject.next(List());
              return EMPTY;
            }

            if (deltas.getIn([0, "seq"]) - snapshot.seq === 1) {
              const nextDeltas = [deltas.get(0)];
              deltas = deltas.rest();

              // Making sure there isn't any gap in the delta sequence.
              while (!deltas.isEmpty()) {
                const delta = deltas.get(0);
                if (delta.seq - nextDeltas[nextDeltas.length - 1].seq > 1) {
                  break;
                }
                nextDeltas.push(delta);
                deltas = deltas.rest();
              }

              this.logger.debug("from(deltas)");
              deltaListsSubject.next(deltas);
              return from(nextDeltas);
            }

            if (!isFetchingGapDeltas) {
              isFetchingGapDeltas = true;

              this.logger.warn(
                `there are gaps in delta and snapshot, fetching deltas between ${
                  snapshot.seq + 1
                } and ${deltas.getIn([0, "seq"]) - 1}`
              );

              this.subscriptions.push(
                from(
                  getRoomDeltas(
                    roomId,
                    snapshot.seq + 1,
                    deltas.getIn([0, "seq"]) - 1
                  )
                )
                  .pipe(
                    tap(() => {
                      isFetchingGapDeltas = false;
                    }),
                    mergeMap((fetchedDeltas) => from(fetchedDeltas)),
                    tap((delta) =>
                      this.logger.log("new detla from http", delta)
                    )
                  )
                  .subscribe((data) => rawDeltasSubject.next(data))
              );
            }

            this.logger.debug("filling the delta gap");
            deltaListsSubject.next(deltas);
            return EMPTY;
          }),
          zipWith(snapshotsSubject),
          tap(([delta, snapshot]) => {
            const snapshotStr = JSON.stringify(snapshot.toJS(), null, 4);
            const deltaStr = JSON.stringify(delta.toJS(), null, 4);
            this.logger.debug(
              `[2] snapshot = ${snapshotStr}\ndelta = ${deltaStr}`
            );
            if (delta.seq - snapshot.seq !== 1) {
              throw new Error("delta.seq and snapshot.seq does not match.");
            }
          }),
          map(([delta, snapshot]) => {
            switch (delta.type) {
              case "ClientJoin": {
                return snapshot
                  .update("seq", (seq) => seq + 1)
                  .update("clientIds", (clientIds) =>
                    clientIds.add(delta.clientId)
                  );
              }
              case "ClientLeft": {
                return snapshot
                  .update("seq", (seq) => seq + 1)
                  .update("clientIds", (clientIds) =>
                    clientIds.delete(delta.clientId)
                  );
              }
              default: {
                return snapshot;
              }
            }
          }),
          tap((data) => {
            this.logger.debug(
              `[3] snapshot = ${JSON.stringify(data.toJS(), null, 4)}`
            );
          })
        )
        .subscribe(snapshotsSubject)
    );

    // UI can subscribe to this
    this.snapshotsObservable = snapshotsSubject.pipe(
      tap((snapshot) =>
        this.logger.debug(
          `[4] snapshot = ${JSON.stringify(snapshot.toJS(), null, 4)}`
        )
      ),
      shareReplay(1)
    );
  }

  destroy() {
    this.logger.debug(`destory()`);

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }
}
