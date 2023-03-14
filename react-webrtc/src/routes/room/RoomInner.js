import { useEffect, useRef, useState } from "react";
import RemoteVideo from "./RemoteVideo";
import LocalVideo from "./LocalVideo";
import WebSocketManager from "../../utils/WebSocketManager";
import PeerConnectionManager from "../../utils/PeerConnectionManager";

export default function RoomInner(props) {
  const webSocketManagerRef = useRef(null);
  const localMediaStreamRef = useRef(null);
  const peerConnectionManagerRef = useRef(null);

  const [remoteVideoToTracksMap, setRemoteVideoToTracksMap] = useState({});
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [otherClients, setOtherClients] = useState(new Set());

  useEffect(() => {
    let isStopped = false;

    const webSocketManager = new WebSocketManager({
      open() {
        webSocketManager.send({
          action: "JoinRoom",
          roomId: props.roomId,
        });
      },
      message(data) {
        if (isStopped) {
          return;
        }

        console.log(data);

        switch (data.type) {
          case "ClientList":
            setOtherClients((clients) => new Set([...clients]));
            break;
          case "ClientJoin": {
            setOtherClients((clients) => new Set([...clients, data.clientId]));

            const peerConnectionManager = new PeerConnectionManager(
              data.clientId,
              {
                onIceCandidate(candidate) {
                  if (isStopped) {
                    return;
                  }

                  webSocketManager.send({
                    action: "ConnectClient",
                    targetClientId: data.clientId,
                    messageData: candidate, // {type: "offer", sdp: "..."}
                  });
                },
                onTrack(track) {
                  if (isStopped) {
                    return;
                  }

                  console.log(track);

                  setRemoteVideoToTracksMap((map) => ({
                    ...map,
                    [data.clientId]: {
                      ...map[data.clientId],
                      [track.kind]: track,
                    },
                  }));
                },
              }
            );

            peerConnectionManager.createConnection();

            if (localMediaStreamRef.current != null) {
              for (const track of localMediaStreamRef.current.getTracks()) {
                peerConnectionManager.addTrack(
                  track,
                  localMediaStreamRef.current
                );
              }
            }

            peerConnectionManager.createOffer().then((offer) => {
              if (isStopped) {
                return;
              }

              webSocketManager.send({
                action: "ConnectClient",
                targetClientId: data.clientId,
                messageData: offer, // {type: "offer", sdp: "..."}
              });
            });

            peerConnectionManagerRef.current = peerConnectionManager;
            break;
          }
          case "ClientLeft":
            setOtherClients(
              (clients) =>
                new Set([
                  ...Array.from(clients).filter(
                    (clientId) => clientId !== data.clientId
                  ),
                ])
            );
            if (peerConnectionManagerRef.current != null) {
              peerConnectionManagerRef.current.destroy();
              peerConnectionManagerRef.current = null;
            }
            break;
          case "ConnectClient": {
            if (data.messageData.type === "offer") {
              const peerConnectionManager = new PeerConnectionManager(
                data.fromClientId,
                {
                  onIceCandidate(candidate) {
                    if (isStopped) {
                      return;
                    }

                    webSocketManager.send({
                      action: "ConnectClient",
                      targetClientId: data.fromClientId,
                      messageData: candidate, // {candidate, usernameFragment, sdpMLineIndex, sdpMid}
                    });
                  },
                  onTrack(track) {
                    if (isStopped) {
                      return;
                    }

                    console.log(track);

                    setRemoteVideoToTracksMap((map) => ({
                      ...map,
                      [data.fromClientId]: {
                        ...map[data.fromClientId],
                        [track.kind]: track,
                      },
                    }));
                  },
                }
              );

              peerConnectionManager.createConnection();
              if (localMediaStreamRef.current != null) {
                for (const track of localMediaStreamRef.current.getTracks()) {
                  peerConnectionManager.addTrack(
                    track,
                    localMediaStreamRef.current
                  );
                }
              }
              peerConnectionManager
                .setOfferAndCreateAnswer(data.messageData)
                .then((answer) => {
                  if (isStopped) {
                    return;
                  }

                  webSocketManager.send({
                    action: "ConnectClient",
                    targetClientId: data.fromClientId,
                    messageData: answer, // {type: "answer", sdp: "..."}
                  });
                });

              peerConnectionManagerRef.current = peerConnectionManager;
            } else if (data.messageData.type === "answer") {
              peerConnectionManagerRef.current.setAnswer(data.messageData);
            } else {
              if (peerConnectionManagerRef.current != null) {
                peerConnectionManagerRef.current.addIceCandidate(
                  data.messageData
                );
              }
            }
            break;
          }
          default:
            break;
        }
      },
      close() {},
    });

    webSocketManager.connect();

    webSocketManagerRef.current = webSocketManager;

    return () => {
      isStopped = true;

      webSocketManagerRef.current.close();

      if (peerConnectionManagerRef.current != null) {
        peerConnectionManagerRef.current.destroy();
        peerConnectionManagerRef.current = null;
      }
    };
  }, [props.roomId]);

  useEffect(() => {
    let isStopped = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        if (isStopped) {
          return;
        }

        setLocalMediaStream(mediaStream);

        if (peerConnectionManagerRef.current != null) {
          for (const track of mediaStream.getTracks()) {
            peerConnectionManagerRef.current.addTrack(track, mediaStream);
          }
        }

        localMediaStreamRef.current = mediaStream;
      })
      .catch((err) => console.error("Getting user media failed.", err));

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
        Room ID: <pre>{props.roomId}</pre>
      </h1>
      <div className="Room_videos-container">
        <LocalVideo mediaStream={localMediaStream} />
        {/* {Array.from(otherClients).map((clientId) => (
          <div key={clientId}>{clientId}</div>
        ))} */}
        {Object.entries(remoteVideoToTracksMap).map(
          ([key, { video, audio }]) => (
            <RemoteVideo key={key} audioTrack={audio} videoTrack={video} />
          )
        )}
      </div>
    </div>
  );
}
