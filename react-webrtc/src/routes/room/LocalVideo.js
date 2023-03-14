import { useEffect, useRef } from "react";

export default function LocalVideo(props) {
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current.srcObject = props.mediaStream;
  }, [props.mediaStream]);

  return (
    <div className="Room_single-video-container Room_single-video-container-self">
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
