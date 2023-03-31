import { Record, Set } from "immutable";

export type RawSnapshot = {
  seq: number;
  clientIds: string[];
};

export default class Snapshot extends Record({
  seq: -1,
  clientIds: Set<string>(),
}) {}
