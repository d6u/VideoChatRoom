import { Record } from "immutable";
import { ClientJoinDelta, ClientLeftDelta, DeltaType } from "shared-models";

export class ClientJoinDeltaRecord extends Record<ClientJoinDelta>({
  type: DeltaType.ClientJoin,
  seq: -1,
  clientId: "",
}) {}

export class ClientLeftDeltaRecord extends Record<ClientLeftDelta>({
  type: DeltaType.ClientLeft,
  seq: -1,
  clientId: "",
}) {}

export type DeltaRecord = ClientJoinDeltaRecord | ClientLeftDeltaRecord;
