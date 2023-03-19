import { useEffect, useRef, useState } from "react";
import classNames from "classnames";

export default function ClientBox(props) {
  let { clientId, localMediaStream, client } = props;

  const isLocal = client.connectionRole === "LOCAL";
  const isRemote = client.connectionRole === "REMOTE";

  const videoRef = useRef(null);

  useEffect(() => {
    let videoTrackSubjectSubscriber = null;
    let audioTrackSubjectSubscriber = null;

    if (isLocal) {
      videoRef.current.srcObject = localMediaStream;
    } else if (isRemote) {
      videoTrackSubjectSubscriber = client.videoTrackSubject.subscribe(
        (videoTrack) => {
          console.log("client.videoTrackSubject", videoTrack);
          if (videoRef.current.srcObject == null) {
            videoRef.current.srcObject = new MediaStream();
          }
          if (videoTrack != null) {
            videoRef.current.srcObject.addTrack(videoTrack);
          }
        }
      );
      audioTrackSubjectSubscriber = client.audioTrackSubject.subscribe(
        (audioTrack) => {
          console.log("client.audioTrackSubject", audioTrack);
          if (videoRef.current.srcObject == null) {
            videoRef.current.srcObject = new MediaStream();
          }
          if (audioTrack != null) {
            videoRef.current.srcObject.addTrack(audioTrack);
          }
        }
      );
    }

    return () => {
      videoTrackSubjectSubscriber?.unsubscribe();
      audioTrackSubjectSubscriber?.unsubscribe();
    };
  }, [
    isLocal,
    isRemote,
    localMediaStream,
    client.videoTrackSubject,
    client.audioTrackSubject,
  ]);

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
