import { useEffect, useRef } from "react";
import classNames from "classnames";
import ClientBoxRemote from "./ClientBoxRemote";

export default function ClientBox({
  clientId,
  wsMessageObserver,
  onWsMessage,
  localMediaStreamSubject,
  localClientId,
}) {
  const isLocal = localClientId != null && clientId === localClientId;
  const isRemote = localClientId != null && clientId !== localClientId;

  if (isLocal) {
    return (
      <ClientBoxLocal
        key={clientId}
        clientId={clientId}
        localMediaStreamSubject={localMediaStreamSubject}
      />
    );
  } else if (isRemote) {
    return (
      <ClientBoxRemote
        key={clientId}
        clientId={clientId}
        wsMessageObserver={wsMessageObserver}
        onWsMessage={onWsMessage}
        localMediaStreamSubject={localMediaStreamSubject}
      />
    );
  } else {
    return (
      <div
        className={classNames({
          "Room_single-video-container": true,
        })}
      >
        <div>
          <code>(UNKNOWN) {clientId}</code>
        </div>
      </div>
    );
  }
}

function ClientBoxLocal({ clientId, localMediaStreamSubject }) {
  const refVideo = useRef(null);

  useEffect(() => {
    const subscription = localMediaStreamSubject.subscribe((mediaStream) => {
      if (mediaStream != null) {
        refVideo.current.srcObject = mediaStream;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [localMediaStreamSubject]);

  return (
    <div
      className={classNames({
        "Room_single-video-container": true,
        "Room_single-video-container-self": true,
      })}
    >
      <div>
        <code>(LOCAL) {clientId}</code>
      </div>
      <video
        ref={refVideo}
        width={320}
        height={240}
        muted={true}
        autoPlay
        playsInline
      />
    </div>
  );
}
