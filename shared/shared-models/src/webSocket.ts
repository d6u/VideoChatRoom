// --- Direct Message ---

export type LeaderSelectionDirectMessage = {
  type: "SelectingLeader" | "ConfirmingLeader";
  randomValue: number;
};

export type SignalingDirectMessage =
  | {
      type: "Description";
      seq: number;
      description: RTCSessionDescriptionInit;
    }
  | {
      type: "IceCandidate";
      seq: number;
      candidate: RTCIceCandidateInit;
    };

export type DirectMessage =
  | LeaderSelectionDirectMessage
  | SignalingDirectMessage;

export function isLeaderSelectionMessage(
  message: DirectMessage
): message is LeaderSelectionDirectMessage {
  return (
    message.type === "SelectingLeader" || message.type === "ConfirmingLeader"
  );
}

export function isSignalingDirectMessage(
  message: DirectMessage
): message is SignalingDirectMessage {
  return !isLeaderSelectionMessage(message);
}

// --- Action type ---

export type WebSocketActionJoinRoom = {
  action: "JoinRoom";
  roomId: string;
};

export type WebSocketActionDirectMessage = {
  action: "DirectMessage";
  toClientId: string;
  message: DirectMessage;
};

export type WebSocketAction =
  | WebSocketActionJoinRoom
  | WebSocketActionDirectMessage;

// --- Message type ---

export type WebSocketMessageCurrentClientId = {
  isDelta: false;
  type: "CurrentClientId";
  clientId: string;
};

export type WebSocketMessageDirectMessage = {
  isDelta: false;
  type: "DirectMessage";
  fromClientId: string;
  message: DirectMessage;
};

export type WebSocketNonDeltaMessage =
  | WebSocketMessageCurrentClientId
  | WebSocketMessageDirectMessage;

export type WebSocketMessageClientJoin = {
  isDelta: true;
  type: "ClientJoin";
  seq: number;
  clientId: string;
};

export type WebSocketMessageClientLeft = {
  isDelta: true;
  type: "ClientLeft";
  seq: number;
  clientId: string;
};

export type WebSocketDeltaMessage =
  | WebSocketMessageClientJoin
  | WebSocketMessageClientLeft;

export type WebSocketMessage = WebSocketNonDeltaMessage | WebSocketDeltaMessage;

export function filterForWebSocketMessageDirectMessage(fromClientId: string) {
  return function (
    message: WebSocketMessage
  ): message is WebSocketMessageDirectMessage {
    return (
      !message.isDelta &&
      message.type === "DirectMessage" &&
      message.fromClientId === fromClientId
    );
  };
}
