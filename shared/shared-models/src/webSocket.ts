import { DirectMessage } from "./directMessage.js";

// --- Action type ---

export enum WebSocketActionType {
  JoinRoom = "JoinRoom",
  DirectMessage = "DirectMessage",
}

export type WebSocketActionJoinRoom = {
  action: WebSocketActionType.JoinRoom;
  roomId: string;
};

export type WebSocketActionDirectMessage = {
  action: WebSocketActionType.DirectMessage;
  toClientId: string;
  message: DirectMessage;
};

export type WebSocketAction =
  | WebSocketActionJoinRoom
  | WebSocketActionDirectMessage;

// --- Message type ---

export enum WebSocketMessageType {
  CurrentClientId = "CurrentClientId",
  DirectMessage = "DirectMessage",
  ClientJoin = "ClientJoin",
  ClientLeft = "ClientLeft",
}

export type WebSocketMessageCurrentClientId = {
  isDelta: false;
  type: WebSocketMessageType.CurrentClientId;
  clientId: string;
};

export type WebSocketMessageDirectMessage = {
  isDelta: false;
  type: WebSocketMessageType.DirectMessage;
  fromClientId: string;
  message: DirectMessage;
};

export type WebSocketNonDeltaMessage =
  | WebSocketMessageCurrentClientId
  | WebSocketMessageDirectMessage;

export type WebSocketMessageClientJoin = {
  isDelta: true;
  type: WebSocketMessageType.ClientJoin;
  seq: number;
  clientId: string;
};

export type WebSocketMessageClientLeft = {
  isDelta: true;
  type: WebSocketMessageType.ClientLeft;
  seq: number;
  clientId: string;
};

export type WebSocketDeltaMessage =
  | WebSocketMessageClientJoin
  | WebSocketMessageClientLeft;

export type WebSocketMessage = WebSocketNonDeltaMessage | WebSocketDeltaMessage;

export function isCurrentClientIdMessage(
  message: WebSocketMessage
): message is WebSocketMessageCurrentClientId {
  return message.type === WebSocketMessageType.CurrentClientId;
}

export function filterForWebSocketMessageDirectMessage(fromClientId: string) {
  return function (
    message: WebSocketMessage
  ): message is WebSocketMessageDirectMessage {
    return (
      !message.isDelta &&
      message.type === WebSocketMessageType.DirectMessage &&
      message.fromClientId === fromClientId
    );
  };
}
