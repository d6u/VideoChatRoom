import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { Subscription, filter, map, partition, share, takeWhile } from "rxjs";

import ClientPeerConnection from "../../../apis/ClientPeerConnection";
import webSocketManager from "../../../apis/WebSocketManager";

function filterDirectMessage(clientId) {
  return function (data) {
    return (
      !data.isDelta &&
      data.type === "DirectMessage" &&
      data.fromClientId === clientId
    );
  };
}

export default function ClientBoxRemote({ clientId, localMediaStreamSubject }) {
  const refVideo = useRef(null);
  const refClientPeerConnection = useRef(null);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    refClientPeerConnection.current = new ClientPeerConnection(clientId);

    return () => {
      refClientPeerConnection.current.destroy();
    };
  }, [clientId]);

  useEffect(() => {
    const subscription = new Subscription();

    subscription.add(
      refClientPeerConnection.current.eventsSubject.subscribe((event) => {
        switch (event.type) {
          case "SendMessageToRemote":
            webSocketManager.send(event.message);
            break;
          case "RemoteStream":
            refVideo.current.srcObject = event.stream;
            break;
          case "RemoteTrack":
            if (refVideo.current.srcObject == null) {
              refVideo.current.srcObject = new MediaStream();
            }
            refVideo.current.srcObject.addTrack(event.track);
            break;
          default:
            break;
        }
      })
    );

    const [
      leaderSelectionMessagesObservable,
      signalingRemoteMessageObservable,
    ] = partition(
      webSocketManager.messagesSubject.pipe(
        filter(filterDirectMessage(clientId)),
        map((data) => data.message),
        share()
      ),
      (message) =>
        message.type === "SelectingLeader" ||
        message.type === "ConfirmingLeader"
    );

    refClientPeerConnection.current.startConnectionProcess({
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
      <div>
        <code>(REMOTE) {clientId}</code>
      </div>
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
        onClick={() => {
          setIsMuted((isMuted) => !isMuted);
        }}
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
