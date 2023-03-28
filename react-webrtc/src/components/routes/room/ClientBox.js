import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

import ClientBoxRemote from "./ClientBoxRemote";

export default function ClientBox({
  clientId,
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

  const [isMuted, setIsMuted] = useState(false);

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
      <code>(LOCAL) {clientId}</code>
      <video
        ref={refVideo}
        width={320}
        height={240}
        muted={true}
        autoPlay
        playsInline
      />
      <button
        className="Room_mute-button"
        onClick={() =>
          setIsMuted((isMuted) => {
            isMuted = !isMuted;

            if (refVideo.current.srcObject != null) {
              const audioTracks = refVideo.current.srcObject.getAudioTracks();
              if (audioTracks.length > 0) {
                audioTracks[0].enabled = !isMuted;
              }
            }

            return isMuted;
          })
        }
      >
        {isMuted ? "Unmute Myself" : "Mute Myself"}
      </button>
    </div>
  );
}
