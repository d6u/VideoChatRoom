import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import ClientBoxRemote from "./ClientBoxRemote";

export default function ClientBox({
  clientId,
  localMediaStream,
  localClientId,
  wsMessageObserver,
  onWsMessage,
}) {
  const isLocal = localClientId != null && clientId === localClientId;
  const isRemote = localClientId != null && clientId !== localClientId;

  if (isLocal) {
    return (
      <ClientBoxLocal clientId={clientId} localMediaStream={localMediaStream} />
    );
  } else if (isRemote) {
    return (
      <ClientBoxRemote
        clientId={clientId}
        localMediaStream={localMediaStream}
        wsMessageObserver={wsMessageObserver}
        onWsMessage={onWsMessage}
      />
    );
  } else {
    return null;
  }
}

function ClientBoxLocal({ clientId, localMediaStream }) {
  const refVideo = useRef(null);

  useEffect(() => {
    console.log("Running useEffect(callback, [localMediaStream])");
    refVideo.current.srcObject = localMediaStream;
  }, [localMediaStream]);

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
