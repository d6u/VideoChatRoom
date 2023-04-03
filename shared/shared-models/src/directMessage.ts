export enum DirectMessageType {
  SelectingLeader = "SelectingLeader",
  ConfirmingLeader = "ConfirmingLeader",
  Description = "Description",
  IceCandidate = "IceCandidate",
}

export type LeaderSelectionDirectMessage = {
  type: DirectMessageType.SelectingLeader | DirectMessageType.ConfirmingLeader;
  randomValue: number;
};

export type DescriptionDirectMessage = {
  type: DirectMessageType.Description;
  seq: number;
  description: RTCSessionDescriptionInit;
};

export type IceCandidateDirectMessage = {
  type: DirectMessageType.IceCandidate;
  seq: number;
  candidate: RTCIceCandidateInit;
};

export type SignalingDirectMessage =
  | DescriptionDirectMessage
  | IceCandidateDirectMessage;

export type DirectMessage =
  | LeaderSelectionDirectMessage
  | SignalingDirectMessage;

export function isLeaderSelectionMessage(
  message: DirectMessage
): message is LeaderSelectionDirectMessage {
  return (
    message.type === DirectMessageType.SelectingLeader ||
    message.type === DirectMessageType.ConfirmingLeader
  );
}

export function isSignalingDirectMessage(
  message: DirectMessage
): message is SignalingDirectMessage {
  return !isLeaderSelectionMessage(message);
}
