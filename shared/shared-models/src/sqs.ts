export type SqsMessageClientJoin = {
  action: "ClientJoin";
  roomId: string;
  clientId: string;
};

export type SqsMessageClientLeft = {
  action: "ClientLeft";
  roomId: string;
  clientId: string;
};

export type SqsMessageBody = SqsMessageClientJoin | SqsMessageClientLeft;
