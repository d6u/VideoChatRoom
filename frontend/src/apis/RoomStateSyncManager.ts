import { Set } from "immutable";
import {
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  defer,
  filter,
  first,
  from,
  map,
  mergeMap,
  share,
  shareReplay,
  tap,
  zipWith,
} from "rxjs";
import {
  Delta,
  DeltaType,
  WebSocketMessage,
  isDeltaMessage,
} from "shared-models";

import {
  ClientJoinDeltaRecord,
  ClientLeftDeltaRecord,
  DeltaRecord,
} from "../models/Delta";
import SnapshotRecord from "../models/Snapshot";
import { exhaustiveMatchingGuard } from "../utils";
import Logger from "../utils/Logger";
import { sort } from "../utils/operators";
import { getRoomDeltas, getRoomSnapshot, isSnapshotOkResponse } from "./Api";

export default class RoomStateSyncManager {
  roomStatesObservable: Observable<SnapshotRecord> | null = null;

  private subscription = new Subscription(() => {
    this.logger.debug("subscription disposed");
  });
  private rawDeltasSubject = new Subject<Delta>();
  private isFetchingGapDeltas = false;
  private logger: Logger;
  private roomId: string;

  constructor(roomId: string, wsObservable: Observable<WebSocketMessage>) {
    this.logger = new Logger("RoomStateSyncManager");
    this.logger.log("constructor()");

    this.roomId = roomId;

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

    const snapshotsSubject = new ReplaySubject<SnapshotRecord>(1);

    const deltasObservable = this.rawDeltasSubject.pipe(
      map((delta) => {
        switch (delta.type) {
          case DeltaType.ClientJoin:
            return new ClientJoinDeltaRecord(delta);
          case DeltaType.ClientLeft:
            return new ClientLeftDeltaRecord(delta);
          default:
            exhaustiveMatchingGuard(delta);
        }
      }),
      tap((delta) => {
        this.logger.debug("new delta", delta.toJS());
      }),
      share()
    );

    // --- Fetch initial snapshot ---
    this.subscription.add(
      defer(() => getRoomSnapshot(this.roomId))
        .pipe(
          filter(isSnapshotOkResponse),
          map(
            ({ snapshot }) =>
              new SnapshotRecord({
                seq: snapshot.seq,
                clientIds: Set(snapshot.clientIds),
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
      wsObservable
        .pipe(
          filter(isDeltaMessage),
          map((data) => data.delta),
          tap((delta) => {
            this.logger.debug("new detla from ws", delta);
          })
        )
        .subscribe(this.rawDeltasSubject)
    );

    // --- Apply delta to snapshot ---
    this.subscription.add(
      deltasObservable
        .pipe(
          sort({
            getPrevSeqObservable: () =>
              snapshotsSubject.pipe(
                map((snapshot) => snapshot.seq),
                first()
              ),
            seqSelector: (delta) => delta.seq,
            notifySequenceGap: ({ fromSeq, toSeq }) => {
              this.fetchGapDeltas(roomId, fromSeq, toSeq);
            },
          }),
          zipWith(snapshotsSubject),
          tap(([delta, snapshot]) => {
            const snapshotStr = JSON.stringify(snapshot.toJS(), null, 4);
            const deltaStr = JSON.stringify(delta.toJS(), null, 4);
            this.logger.debug(
              `[2] snapshot = ${snapshotStr}\ndelta = ${deltaStr}`
            );
            if (delta.seq! - snapshot.seq !== 1) {
              throw new Error("delta.seq and snapshot.seq does not match.");
            }
          }),
          map(([delta, snapshot]) => this.reducer(snapshot, delta)),
          tap((data) => {
            this.logger.debug(
              `[3] snapshot = ${JSON.stringify(data.toJS(), null, 4)}`
            );
          })
        )
        .subscribe(snapshotsSubject)
    );

    // UI can subscribe to this
    this.roomStatesObservable = snapshotsSubject.pipe(
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

  private reducer(snapshot: SnapshotRecord, delta: DeltaRecord) {
    switch (delta.type!) {
      case DeltaType.ClientJoin: {
        return snapshot
          .update("seq", (seq) => seq + 1)
          .update("clientIds", (clientIds) => clientIds.add(delta.clientId));
      }
      case DeltaType.ClientLeft: {
        return snapshot
          .update("seq", (seq) => seq + 1)
          .update("clientIds", (clientIds) => clientIds.delete(delta.clientId));
      }
      default: {
        exhaustiveMatchingGuard(delta.type);
      }
    }
  }

  private fetchGapDeltas(roomId: string, fromSeq: number, toSeq: number) {
    if (this.isFetchingGapDeltas) {
      return;
    }

    this.isFetchingGapDeltas = true;

    this.logger.warn(
      `there are gaps in delta and snapshot between ${fromSeq} and ${toSeq}`
    );

    this.subscription.add(
      defer(() => getRoomDeltas(roomId, fromSeq, toSeq))
        .pipe(
          tap((deltas) => {
            this.isFetchingGapDeltas = false;
            this.logger.log("new detlas from http", deltas);
          }),
          mergeMap((fetchedDeltas) => from(fetchedDeltas))
        )
        .subscribe((data) => {
          // Making sure we don't complete the subject when this
          // observable complete.
          this.rawDeltasSubject.next(data);
        })
    );
  }
}
