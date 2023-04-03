export type Snapshot = {
  roomId: string;
  seq: number;
  clientIds: string[];
};

export enum DeltaType {
  ClientJoin = "ClientJoin",
  ClientLeft = "ClientLeft",
}

export interface Delta {
  roomId: string;
  seq: number;
  type: DeltaType;
}

export interface ClientJoinDelta extends Delta {
  type: DeltaType.ClientJoin;
  clientId: string;
}

export interface ClientLeftDelta extends Delta {
  type: DeltaType.ClientLeft;
  clientId: string;
}
