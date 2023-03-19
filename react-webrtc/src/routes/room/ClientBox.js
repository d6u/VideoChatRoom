import { useEffect, useRef, useState } from "react";
import classNames from "classnames";

export default function ClientBox(props) {
  let { clientId, localMediaStream, client } = props;

  const isLocal = client.connectionRole === "LOCAL";

  const videoRef = useRef(null);

  useEffect(() => {
    if (isLocal) {
      videoRef.current.srcObject = localMediaStream;
    }
  }, [isLocal, localMediaStream]);

  return (
    <div
      className={classNames({
        "Room_single-video-container": true,
        "Room_single-video-container-self": isLocal,
      })}
    >
      <div>
        <code>{`(${client.connectionRole}, ${client.peerConnectionRole}) ${clientId}`}</code>
      </div>
      <video
        ref={videoRef}
        width={320}
        height={240}
        muted={true}
        autoPlay
        playsInline
      />
    </div>
  );
}
