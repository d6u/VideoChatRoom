export enum SqsMessageBodyAction {
  ClientJoin = "ClientJoin",
  ClientLeft = "ClientLeft",
}

export type ClientJoinSqsMessageBody = {
  action: SqsMessageBodyAction.ClientJoin;
  roomId: string;
  clientId: string;
};

export type ClientLeftSqsMessageBody = {
  action: SqsMessageBodyAction.ClientLeft;
  roomId: string;
  clientId: string;
};

export type SqsMessageBody =
  | ClientJoinSqsMessageBody
  | ClientLeftSqsMessageBody;
