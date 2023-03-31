import { Record } from "immutable";

export type RawDelta = {
  type: "" | "ClientJoin" | "ClientLeft";
  seq: -1;
  clientId: "";
};

export type DeltaType = RawDelta;

export default class Delta extends Record<DeltaType>({
  type: "",
  seq: -1,
  clientId: "",
}) {}
