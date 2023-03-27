import { List, Set } from "immutable";
import {
  BehaviorSubject,
  EMPTY,
  ReplaySubject,
  Subject,
  Subscription,
  defer,
  filter,
  first,
  from,
  map,
  merge,
  mergeMap,
  share,
  shareReplay,
  tap,
  withLatestFrom,
  zipWith,
} from "rxjs";

import Delta from "../models/Delta";
import Snapshot from "../models/Snapshot";
import Logger from "../utils/Logger";
import { getRoomDeltas, getRoomSnapshot } from "./Api";

export default class RoomStateSyncManager {
  constructor(roomId, wsObservable) {
    this.logger = new Logger("RoomStateSyncManager");
    this.logger.log("constructor()");

    this.roomId = roomId;
    this.wsObservable = wsObservable;

    /**
     * === READ FIRST ===
     *
     * Below, I tried to do a couple things:
     *
     * - On every delta we received we accumulate them into a list.
     * - Everytime thre is a new delta or a new snapshot (if it's a new detla,
     *   accumulate it in the list first), trigger the logic to apply deltas
     *   to existing snapshot to come up with a new snapshot.
     * - In this process we remove the delta that is already applied to the
     *   snapshot from the deltas list.
     * - When a delta's seq # is larged than the snapshot's seq # by more
     *   than 1, it means there is an gap. Stop further process and start
     *   fetching deltas to fill the gap, and repeat above process.
     * - The new snapshot is then supplied as new snapshot, thus triggering
     *   the flow from the beginning again.
     * - Do above until all deltas have exhausted. Then we will wait for new
     *   deltas from WebSocket API.
     *
     * Below logic are very involved and possibly over engineered just to show
     * case how we can implement above requirements using RxJS.
     *
     * Using a more traditional reactive state management framework will yield
     * a much simpler and easy to understand implementation.
     */

    const rawDeltasSubject = new Subject();
    const deltaListsSubject = new BehaviorSubject(List());
    const snapshotsSubject = new ReplaySubject(1);

    const deltasObservable = rawDeltasSubject.pipe(
      map(Delta),
      tap((delta) => {
        this.logger.debug("new delta", delta.toJS());
      }),
      share()
    );

    let isFetchingGapDeltas = false;

    this.subscription = new Subscription(() => {
      this.logger.debug("subscription disposed");
    });

    // --- Fetch initial snapshot ---
    this.subscription.add(
      defer(() => from(getRoomSnapshot(this.roomId)))
        .pipe(
          map((data) =>
            Snapshot({
              roomId: this.roomId,
              seq: data.seq,
              clientIds: Set(data.clientIds),
            })
          ),
          tap((snapshot) => {
            this.logger.debug("new snapshot", snapshot.toJS());
          })
        )
        .subscribe((snapshot) =>
          // Making sure we don't complete the subject when this
          // observable complete.
          snapshotsSubject.next(snapshot)
        )
    );

    // --- Subscribe to deltas from WebSocket API ---
    this.subscription.add(
      this.wsObservable
        .pipe(
          filter((message) => message.isDelta),
          tap((delta) => {
            this.logger.debug("new detla from ws", delta);
          })
        )
        .subscribe(rawDeltasSubject)
    );

    // --- Accumulate delta to deltaListSubject ---
    this.subscription.add(
      deltasObservable
        .pipe(
          withLatestFrom(deltaListsSubject),
          map(([delta, deltas]) => deltas.push(delta))
        )
        .subscribe(deltaListsSubject)
    );

    // --- Apply delta to snapshot ---
    this.subscription.add(
      merge(snapshotsSubject, deltasObservable)
        .pipe(
          mergeMap(() => snapshotsSubject.pipe(first())),
          withLatestFrom(deltaListsSubject),
          map(([snapshot, deltas]) => {
            return [
              snapshot,
              // TODO: Making sure there isn't any duplicates
              deltas.sortBy((d) => d.seq).filter((d) => d.seq > snapshot.seq),
            ];
          }),
          tap(([snapshot, deltas]) => {
            const snapshotStr = JSON.stringify(snapshot.toJS(), null, 4);
            const deltasStr = JSON.stringify(deltas.toJS(), null, 4);
            this.logger.debug(
              `[1] snapshot = ${snapshotStr}\ndeltas = ${deltasStr}`
            );
          }),
          mergeMap(([snapshot, deltas]) => {
            if (deltas.size === 0) {
              this.logger.debug("not delta in delta list");
              deltaListsSubject.next(List());
              return EMPTY;
            }

            if (deltas.getIn([0, "seq"]) === snapshot.seq + 1) {
              let prevIndex = 0;

              for (let i = 1; i < deltas.size; i++) {
                if (
                  deltas.getIn([i, "seq"]) !==
                  deltas.getIn([prevIndex, "seq"]) + 1
                ) {
                  break;
                }
                prevIndex = i;
              }

              this.logger.debug("passing delta down the stream");
              deltaListsSubject.next(deltas.slice(prevIndex + 1));
              return from(deltas.slice(0, prevIndex + 1));
            }

            if (!isFetchingGapDeltas) {
              isFetchingGapDeltas = true;

              const fromSeq = snapshot.seq + 1;
              const toSeq = deltas.getIn([0, "seq"]) - 1;
              this.logger.warn(
                `there are gaps in delta and snapshot between ${fromSeq} and ${toSeq}`
              );

              this.subscription.add(
                from(getRoomDeltas(roomId, fromSeq, toSeq))
                  .pipe(
                    tap(() => {
                      isFetchingGapDeltas = false;
                    }),
                    mergeMap((fetchedDeltas) => from(fetchedDeltas)),
                    tap((delta) => {
                      this.logger.log("new detla from http", delta);
                    })
                  )
                  .subscribe((data) => {
                    // Making sure we don't complete the subject when this
                    // observable complete.
                    rawDeltasSubject.next(data);
                  })
              );
            }

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
      tap((snapshot) => {
        this.logger.debug(
          `[4] snapshot = ${JSON.stringify(snapshot.toJS(), null, 4)}`
        );
      }),
      shareReplay(1)
    );
  }

  destroy() {
    this.logger.debug(`destory()`);
    this.subscription.unsubscribe();
  }
}
