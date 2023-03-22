import { nanoid } from "nanoid";
import {
  BehaviorSubject,
  combineLatestWith,
  defer,
  EMPTY,
  filter,
  from,
  map,
  mergeMap,
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
    this.instanceId = nanoid();
    this.log("constructor()");

    this.roomId = roomId;
    this.wsObservable = wsObservable;

    // === Deltas ===

    const rawDeltasSubject = new Subject();
    const deltasAccumulatorSubject = new BehaviorSubject(List());
    const snapshotsSubject = new Subject();

    const deltasObservable = rawDeltasSubject.pipe(
      map((data) => Delta(data)),
      tap((delta) => this.log("new delta", delta.toJS())),
      share()
    );

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
          tap((snapshot) => this.log("new snapshot", snapshot.toJS()))
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
          mergeMap(() => deltasAccumulatorSubject.pipe(take(1)))
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

            this.log(
              `there are gaps in delta and snapshot, fetching deltas between ${
                snapshot.seq + 1
              } and ${deltas.getIn([0, "seq"]) - 1}`
            );

            // TODO: Making sure we don't double fetching
            this.subscriptions.push(
              from(
                getRoomDeltas(
                  roomId,
                  snapshot.seq + 1,
                  deltas.getIn([0, "seq"]) - 1
                )
              )
                .pipe(mergeMap((fetchedDeltas) => from(fetchedDeltas)))
                .subscribe(rawDeltasSubject)
            );

            deltasAccumulatorSubject.next(deltas);
            return EMPTY;
          }),
          zipWith(snapshotsSubject),
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
          })
        )
        .subscribe(snapshotsSubject)
    );

    this.snapshotsObservable = snapshotsSubject.pipe(
      tap((delta) => this.log("finalized snapshot for UI", delta.toJS())),
      shareReplay(1)
    );
  }

  log(...args) {
    console.debug(
      `%cRoomStateSyncManager [${this.instanceId}]`,
      "background: yellow",
      ...args
    );
  }

  logError(...args) {
    console.error(
      `%cRoomStateSyncManager [${this.instanceId}]`,
      "background: yellow",
      ...args
    );
  }

  destroy() {
    this.log(`destory()`);

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }
}
