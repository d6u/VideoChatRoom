export enum DeltaType {
  ClientJoin = "ClientJoin",
  ClientLeft = "ClientLeft",
}

export type ClientJoinDelta = {
  type: DeltaType.ClientJoin;
  seq: number;
  clientId: string;
};

export type ClientLeftDelta = {
  type: DeltaType.ClientLeft;
  seq: number;
  clientId: string;
};
