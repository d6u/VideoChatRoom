import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

export default function ClientBoxLocal({ clientId, localMediaStreamSubject }) {
  const refVideo = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isLocalTrackSet, setIsLocalTrackSet] = useState(false);

  useEffect(() => {
    const subscription = localMediaStreamSubject.subscribe((mediaStream) => {
      if (mediaStream != null) {
        setIsLocalTrackSet(true);
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
      <code>{clientId}</code>
      <video
        key={clientId}
        ref={refVideo}
        width={320}
        height={240}
        muted={true}
        autoPlay
        playsInline
      />
      {isLocalTrackSet && (
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
      )}
    </div>
  );
}
