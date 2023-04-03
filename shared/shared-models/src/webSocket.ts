import { DirectMessage } from "./directMessage.js";
import { Delta } from "./entities.js";

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
  Delta = "Delta",
}

export type WebSocketMessageCurrentClientId = {
  type: WebSocketMessageType.CurrentClientId;
  clientId: string;
};

export type WebSocketMessageDirectMessage = {
  type: WebSocketMessageType.DirectMessage;
  fromClientId: string;
  message: DirectMessage;
};

export type WebSocketDeltaMessage = {
  type: WebSocketMessageType.Delta;
  delta: Delta;
};

export type WebSocketMessage =
  | WebSocketMessageCurrentClientId
  | WebSocketMessageDirectMessage
  | WebSocketDeltaMessage;

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
      message.type === WebSocketMessageType.DirectMessage &&
      message.fromClientId === fromClientId
    );
  };
}

export function isDeltaMessage(
  message: WebSocketMessage
): message is WebSocketDeltaMessage {
  return message.type === WebSocketMessageType.Delta;
}
