import { Record, Set } from "immutable";

export default class SnapshotRecord extends Record<{
  seq: number;
  clientIds: Set<string>;
}>({
  seq: -1,
  clientIds: Set<string>(),
}) {}
