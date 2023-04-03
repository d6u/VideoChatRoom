import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { Subject, Subscription, takeWhile } from "rxjs";
import { DirectMessageType } from "shared-models";

import ClientPeerConnection, {
  ClientPeerConnectionEventType,
} from "../../../apis/ClientPeerConnection";
import webSocketManager from "../../../apis/WebSocketManager";
import { exhaustiveMatchingGuard } from "../../../utils";

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
          case ClientPeerConnectionEventType.SendMessageToRemote:
            webSocketManager.send(event.message);
            break;
          case ClientPeerConnectionEventType.RemoteStream:
            refVideo.current!.srcObject = event.stream;
            break;
          case ClientPeerConnectionEventType.RemoteTrack:
            if (refVideo.current!.srcObject == null) {
              refVideo.current!.srcObject = new MediaStream();
            }
            (refVideo.current!.srcObject as MediaStream).addTrack(event.track);
            break;
          default:
            exhaustiveMatchingGuard(event);
        }
      })
    );

    const [
      leaderSelectionMessagesObservable,
      signalingRemoteMessageObservable,
    ] = webSocketManager.partitionDirectMessagesFromClientId(clientId);

    refClientPeerConnection.current!.startConnectionProcess({
      leaderSelectionMessagesObservable: leaderSelectionMessagesObservable.pipe(
        takeWhile(
          (message) => message.type !== DirectMessageType.ConfirmingLeader,
          true
        )
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
