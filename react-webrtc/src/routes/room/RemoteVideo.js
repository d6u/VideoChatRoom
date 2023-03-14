import { useEffect, useRef } from "react";

export default function RemoteVideo(props) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current.srcObject == null) {
      videoRef.current.srcObject = new MediaStream();
    }

    if (props.videoTrack != null) {
      videoRef.current.srcObject.addTrack(props.videoTrack);
    }

    if (props.audioTrack != null) {
      videoRef.current.srcObject.addTrack(props.audioTrack);
    }
  }, [props.videoTrack, props.audioTrack]);

  return (
    <div className="Room_single-video-container">
      <video ref={videoRef} width={320} height={240} autoPlay playsInline />
    </div>
  );
}
