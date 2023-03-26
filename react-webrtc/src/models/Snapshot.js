import { Record, Set } from "immutable";

const Snapshot = Record({
  roomId: "",
  seq: -1,
  clientIds: Set(),
});

export default Snapshot;
