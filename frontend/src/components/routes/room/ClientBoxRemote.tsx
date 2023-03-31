import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import {
  OperatorFunction,
  Subject,
  Subscription,
  filter,
  map,
  partition,
  share,
  takeWhile,
} from "rxjs";

import ClientPeerConnection from "../../../apis/ClientPeerConnection";
import webSocketManager from "../../../apis/WebSocketManager";
import {
  DirectMessage,
  DirectMessageMessage,
  WebSocketMessage,
} from "../../../models/webSocketMessages";

function filterDirectMessage(clientId: string) {
  return function (data: WebSocketMessage) {
    return (
      !data.isDelta &&
      data.type === "DirectMessage" &&
      data.fromClientId === clientId
    );
  };
}

export default function ClientBoxRemote({
  clientId,
  localMediaStreamSubject,
}: {
  clientId: string;
  localMediaStreamSubject: Subject<MediaStream | null>;
}) {
  const refVideo = useRef<HTMLVideoElement | null>(null);
  const refClientPeerConnection = useRef<null | ClientPeerConnection>(null);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    refClientPeerConnection.current = new ClientPeerConnection(clientId);

    return () => {
      refClientPeerConnection.current!.destroy();
    };
  }, [clientId]);

  useEffect(() => {
    const subscription = new Subscription();

    subscription.add(
      refClientPeerConnection.current!.eventsSubject.subscribe((event) => {
        switch (event.type) {
          case "SendMessageToRemote":
            webSocketManager.send(event.message);
            break;
          case "RemoteStream":
            refVideo.current!.srcObject = event.stream;
            break;
          case "RemoteTrack":
            if (refVideo.current!.srcObject == null) {
              refVideo.current!.srcObject = new MediaStream();
            }
            (refVideo.current!.srcObject as MediaStream).addTrack(event.track);
            break;
          default:
            break;
        }
      })
    );

    const [
      leaderSelectionMessagesObservable,
      signalingRemoteMessageObservable,
    ] = partition<DirectMessage>(
      webSocketManager.messagesSubject.pipe(
        filter(filterDirectMessage(clientId)) as OperatorFunction<
          WebSocketMessage,
          DirectMessageMessage
        >,
        map((data) => data.message),
        share()
      ),
      (message) =>
        message.type === "SelectingLeader" ||
        message.type === "ConfirmingLeader"
    );

    refClientPeerConnection.current!.startConnectionProcess({
      leaderSelectionMessagesObservable: leaderSelectionMessagesObservable.pipe(
        takeWhile((message) => message.type !== "ConfirmingLeader", true)
      ),
      signalingRemoteMessageObservable,
      localMediaStreamObservable: localMediaStreamSubject,
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clientId, localMediaStreamSubject]);

  return (
    <div className={classNames({ "Room_single-video-container": true })}>
      <code>{clientId}</code>
      <video
        key={clientId}
        ref={refVideo}
        width={320}
        height={240}
        muted={isMuted}
        autoPlay
        playsInline
      />
      <button
        className="Room_mute-button"
        onClick={() => {
          setIsMuted((isMuted) => !isMuted);
        }}
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
