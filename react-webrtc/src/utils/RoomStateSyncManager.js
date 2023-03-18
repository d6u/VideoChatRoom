import { Record, Set, List } from "immutable";
import { getRoomSnapshot, getRoomDeltas } from "./Api";

const Snapshot = Record({
  isSynced: false,
  roomId: "",
  seq: -1,
  clientIds: Set(),
});

const Delta = Record({
  type: "",
  seq: -1,
  clientId: "",
});

function reduce(snapshot, delta) {
  if (delta.seq - snapshot.seq !== 1) {
    console.error(
      "Sequence number for snapshot and delta don't match.",
      snapshot,
      delta
    );
    throw new Error("Sequence number for snapshot and delta don't match.");
  }

  switch (delta.type) {
    case "ClientJoin": {
      return snapshot
        .update("seq", (seq) => seq + 1)
        .update("clientIds", (clientIds) => clientIds.add(delta.clientId));
    }
    case "ClientLeft": {
      return snapshot
        .update("seq", (seq) => seq + 1)
        .update("clientIds", (clientIds) => clientIds.delete(delta.clientId));
    }
    default: {
      return snapshot;
    }
  }
}

export default class RoomStateSyncManager extends EventTarget {
  isStopped = false;
  isFillingDeltaGap = false;
  roomId = null;
  snapshot = Snapshot();
  deltas = List();

  constructor(roomId) {
    // console.debug(`RoomStateSyncManager ctor(${roomId})`);
    super();
    this.roomId = roomId;
    this.addEventListener("data", this.handleData);
    this.addEventListener("delta", this.handleDelta);
  }

  destroy() {
    this.isStopped = true;
    this.removeEventListener("data", this.handleData);
    this.removeEventListener("delta", this.handleDelta);
    console.debug(`RoomStateSyncManager destory(). roomId = ${this.roomId})`);
  }

  handleData = () => {
    if (this.isStopped || !this.snapshot.isSynced || this.deltas.size === 0) {
      return;
    }

    this.deltas = this.deltas
      .filter((delta) => delta.seq > this.snapshot.seq)
      .sortBy((delta) => delta.seq);

    const firstDelta = this.deltas.get(0);

    if (firstDelta.seq - this.snapshot.seq > 1) {
      if (!this.isFillingDeltaGap) {
        this.isFillingDeltaGap = true;

        getRoomDeltas(this.roomId, this.snapshot.seq + 1, firstDelta.seq - 1)
          .then((deltas) => {
            if (this.isStopped) {
              return;
            }
            this.isFillingDeltaGap = false;
            this.deltas = List(deltas.map((delta) => Delta(delta))).concat(
              this.deltas
            );
            this.dispatchEvent(new Event("data"));
          })
          .catch((error) => {
            console.error("getRoomDeltas() error.", error);
          });
      }
      return;
    }

    this.deltas.forEach((delta) => {
      this.snapshot = reduce(this.snapshot, delta);
    });

    this.deltas = this.deltas.clear();

    this.dispatchEvent(new CustomEvent("state", { detail: this.snapshot }));
  };

  handleDelta = (event) => {
    if (this.isStopped) {
      return;
    }
    const { detail } = event;
    this.deltas = this.deltas.push(Delta(detail));
    console.table(this.deltas.toJS());
    this.dispatchEvent(new Event("data"));
  };

  start() {
    if (this.isStopped) {
      throw new Error("This instance is already stopped.");
    }

    getRoomSnapshot(this.roomId)
      .then((snapshot) => {
        if (this.isStopped) {
          return;
        }
        this.snapshot = this.snapshot
          .set("isSynced", true)
          .set("seq", snapshot.seq)
          .set("clientIds", Set(snapshot.clientIds));
        this.dispatchEvent(new Event("data"));
      })
      .catch((error) => {
        console.error("getRoomSnapshot() error.", error);
      });
  }
}
