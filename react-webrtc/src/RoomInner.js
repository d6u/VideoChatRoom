import { useContext, useEffect, useRef, useState } from "react";
import RoomManager from "./utils/RoomManager";
import RemoteVideo from "./RemoteVideo";
import DatabaseContext from "./utils/DatabaseContext";
import LocalVideo from "./LocalVideo";

export default function RoomInner(props) {
  const roomManagerRef = useRef(null);
  const localMediaStreamRef = useRef(null);

  const [remoteVideoToTracksMap, setRemoteVideoToTracksMap] = useState({});
  const [localMediaStream, setLocalMediaStream] = useState(null);

  const database = useContext(DatabaseContext);

  useEffect(() => {
    let isStopped = false;

    const roomManager = new RoomManager(database, props.roomKey);

    roomManager.addOnRemoteTrackAvailableListener((remoteClientKey, track) => {
      if (isStopped) {
        return;
      }
      setRemoteVideoToTracksMap((map) => {
        if (map[remoteClientKey] == null) {
          return {
            ...map,
            [remoteClientKey]: {
              [track.kind]: track,
            },
          };
        } else {
          return {
            ...map,
            [remoteClientKey]: {
              ...map[remoteClientKey],
              [track.kind]: track,
            },
          };
        }
      });
    });

    roomManager.addPeerConnectionEndedListener((remoteClientKey) => {
      if (isStopped) {
        return;
      }
      setRemoteVideoToTracksMap((map) => {
        const { [remoteClientKey]: _, ...newMap } = map;
        return newMap;
      });
    });

    roomManagerRef.current = roomManager;

    return () => {
      isStopped = true;
      roomManagerRef.current.destroy();
      roomManagerRef.current = null;
    };
  }, [database, props.roomKey]);

  useEffect(() => {
    let isStopped = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        if (isStopped) {
          return;
        }
        roomManagerRef.current.setLocalMediaStream(mediaStream);
        roomManagerRef.current.joinCurrentRoom();
        setLocalMediaStream(mediaStream);
        localMediaStreamRef.current = mediaStream;
      });

    return () => {
      isStopped = true;
      if (localMediaStreamRef.current != null) {
        localMediaStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
        localMediaStreamRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <h1>
        Room ID: <pre>{props.roomKey}</pre>
      </h1>
      <div className="Room_videos-container">
        <LocalVideo mediaStream={localMediaStream} />
        {Object.entries(remoteVideoToTracksMap).map(
          ([key, { video, audio }]) => (
            <RemoteVideo key={key} audioTrack={audio} videoTrack={video} />
          )
        )}
      </div>
    </div>
  );
}
