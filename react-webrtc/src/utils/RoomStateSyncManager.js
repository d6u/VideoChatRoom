import { nanoid } from "nanoid";
import {
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  mergeMap,
  scan,
  skip,
  Subject,
  tap,
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
    const snapshotsSubject = new Subject();

    const deltasObservable = rawDeltasSubject.pipe(
      map((data) => Delta(data)),
      tap((delta) => this.log("new delta", delta.toJS()))
    );

    this.subscriptions.push(
      this.wsObservable
        .pipe(filter((message) => message.isDelta))
        .subscribe(rawDeltasSubject)
    );

    this.subscriptions.push(
      defer(() => {
        this.log("fetching RoomSnapshot");
        return from(getRoomSnapshot(this.roomId));
      })
        .pipe(
          map((data) =>
            Snapshot({
              roomId: this.roomId,
              seq: data.seq,
              clientIds: Set(data.clientIds),
            })
          ),
          tap((delta) => this.log("new snapshot", delta.toJS()))
        )
        .subscribe((delta) => snapshotsSubject.next(delta))
    );

    this.subscriptions.push(
      combineLatest([snapshotsSubject, deltasObservable])
        .pipe(
          scan(
            ({ stagedDeltas, toBeProcessedDeltas }, [snapshot, delta]) => {
              const deltas = stagedDeltas
                .push(delta)
                .sortBy((d) => d.seq)
                .filter((d) => d.seq > snapshot.seq);
              if (deltas.getIn([0, "seq"]) - snapshot.seq > 1) {
                this.log("there are gaps in delta and snapshot");
                return { stagedDeltas: deltas, toBeProcessedDeltas };
              } else {
                return {
                  stagedDeltas: List(),
                  toBeProcessedDeltas: deltas,
                };
              }
            },
            {
              stagedDeltas: List(),
              toBeProcessedDeltas: List(),
            }
          ),
          distinctUntilChanged(
            ({ toBeProcessedDeltas: prev }, { toBeProcessedDeltas: curr }) =>
              prev.equals(curr)
          ),
          map(({ toBeProcessedDeltas }) => toBeProcessedDeltas),
          filter((deltas) => deltas.size > 0),
          mergeMap((deltas) => from(deltas)),
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

    this.snapshotsObservable = snapshotsSubject.pipe(skip(1));
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
