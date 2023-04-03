export type Snapshot = {
  roomId: string;
  seq: number;
  clientIds: string[];
};

export enum DeltaType {
  ClientJoin = "ClientJoin",
  ClientLeft = "ClientLeft",
}

export type ClientJoinDelta = {
  seq: number;
  type: DeltaType.ClientJoin;
  clientId: string;
};

export type ClientLeftDelta = {
  seq: number;
  type: DeltaType.ClientLeft;
  clientId: string;
};

export type Delta = ClientJoinDelta | ClientLeftDelta;
