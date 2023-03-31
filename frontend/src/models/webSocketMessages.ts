export type DirectMessage =
  | {
      type: "SelectingLeader" | "ConfirmingLeader";
      seq?: number;
      randomValue: number;
    }
  | {
      type: "Description";
      seq: number;
      description: RTCSessionDescriptionInit;
    }
  | {
      type: "IceCandidate";
      seq: number;
      candidate: RTCIceCandidate;
    };

export type CurrentClientIdMessage = {
  isDelta: false;
  type: "CurrentClientId";
  clientId: string;
};

export type DirectMessageMessage = {
  isDelta: false;
  type: "DirectMessage";
  fromClientId: string;
  message: DirectMessage;
};

export type WebSocketMessage = CurrentClientIdMessage | DirectMessageMessage;
