import {
  BehaviorSubject,
  combineLatestWith,
  defer,
  EMPTY,
  filter,
  from,
  map,
  mergeMap,
  of,
  share,
  shareReplay,
  Subject,
  take,
  tap,
  zip,
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
    const deltasAccumulatorSubject = new BehaviorSubject(List());
    const snapshotsSubject = new Subject();

    const deltasObservable = rawDeltasSubject.pipe(
      map((data) => Delta(data)),
      tap((delta) => this.logger.log("new delta", delta.toJS())),
      share()
    );

    let isFetchingGapDeltas = false;

    this.subscriptions.push(
      // --- Initial snapshot ---
      defer(() => from(getRoomSnapshot(this.roomId)))
        .pipe(
          map((data) =>
            Snapshot({
              roomId: this.roomId,
              seq: data.seq,
              clientIds: Set(data.clientIds),
            })
          ),
          tap((snapshot) => this.logger.log("new snapshot", snapshot.toJS()))
        )
        .subscribe((delta) =>
          // Not directly subscribing to snapshotsSubject so we don't complete
          // the snapshotsSubject.
          snapshotsSubject.next(delta)
        ),
      // --- Getting raw deltas from WS ---
      this.wsObservable
        .pipe(filter((message) => message.isDelta))
        .subscribe(rawDeltasSubject),
      // --- ??? ---
      zip(
        deltasObservable,
        deltasObservable.pipe(
          mergeMap(() => of(deltasAccumulatorSubject.getValue()))
        )
      )
        .pipe(
          map(([delta, deltas]) => deltas.push(delta)),
          combineLatestWith(snapshotsSubject),
          map(([deltas, snapshot]) => [
            // TODO: Making sure there isn't any duplicates
            deltas.sortBy((d) => d.seq).filter((d) => d.seq > snapshot.seq),
            snapshot,
          ]),
          tap(([deltas, snapshot]) => {
            const snapshotStr = JSON.stringify(snapshot.toJS(), null, 4);
            const deltasStr = JSON.stringify(deltas.toJS(), null, 4);
            this.logger.debug(
              `[1] snapshot = ${snapshotStr}\ndeltas = ${deltasStr}`
            );
          }),
          mergeMap(([deltas, snapshot]) => {
            if (deltas.size === 0) {
              deltasAccumulatorSubject.next(List());
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

              deltasAccumulatorSubject.next(deltas);
              return from(nextDeltas);
            }

            if (!isFetchingGapDeltas) {
              this.logger.log(
                `there are gaps in delta and snapshot, fetching deltas between ${
                  snapshot.seq + 1
                } and ${deltas.getIn([0, "seq"]) - 1}`
              );

              isFetchingGapDeltas = true;
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
                    mergeMap((fetchedDeltas) => from(fetchedDeltas))
                  )
                  .subscribe((data) => rawDeltasSubject.next(data))
              );
            }

            deltasAccumulatorSubject.next(deltas);
            return EMPTY;
          }),
          zipWith(snapshotsSubject),
          tap(([delta, snapshot]) => {
            const snapshotStr = JSON.stringify(snapshot.toJS(), null, 4);
            const deltaStr = JSON.stringify(delta.toJS(), null, 4);
            this.logger.debug(
              `[2] snapshot = ${snapshotStr}\ndelta = ${deltaStr}`
            );
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
          tap((snapshot) =>
            this.logger.debug(
              `[3] snapshot = ${JSON.stringify(snapshot.toJS(), null, 4)}`
            )
          )
        )
        .subscribe(snapshotsSubject)
    );

    this.snapshotsObservable = snapshotsSubject.pipe(
      tap((snapshot) =>
        this.logger.log(
          `[4] snapshot = ${JSON.stringify(snapshot.toJS(), null, 4)}`
        )
      )
    );
  }

  log(...args) {
    console.debug(`RoomStateSyncManager [${this.instanceId}]`, ...args);
  }

  logError(...args) {
    console.error(`RoomStateSyncManager [${this.instanceId}]`, ...args);
  }

  destroy() {
    this.logger.log(`destory()`);

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }
}
