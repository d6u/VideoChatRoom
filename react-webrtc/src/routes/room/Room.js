import { from, BehaviorSubject } from "rxjs";
import { useEffect, useRef, useState } from "react";
import WebSocketManager from "../../utils/WebSocketManager";
import RoomStateSyncManager from "../../utils/RoomStateSyncManager";
import PeerConnectionsManager from "../../utils/PeerConnectionsManager";
import ClientBox from "./ClientBox";

export default function Room(props) {
  const { roomId } = props;

  const refLocalMediaStreamSubject = useRef(new BehaviorSubject(null));
  const peerConnectionsManagerRef = useRef(null);

  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [currentClientId, setCurrentClientId] = useState(null);
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [clients, setClients] = useState(null);

  useEffect(() => {
    console.group("Room");
    console.group("Room setup");
    console.log(`useEffect(). roomId = ${roomId}`);

    let isStopped = false;

    setConnectionStatus("Connecting");

    const peerConnectionsManager = new PeerConnectionsManager(
      refLocalMediaStreamSubject.current
    );
    peerConnectionsManagerRef.current = peerConnectionsManager;
    const roomStateSyncManager = new RoomStateSyncManager(roomId);
    const ws = new WebSocketManager();

    // === PeerConnectionsManager ===

    function peerConnectionsManagerOnClients(event) {
      const { detail } = event;
      setClients(detail);
    }
    function peerConnectionsManagerOnSelectleader(event) {
      const {
        detail: { clientId, randomValue },
      } = event;

      ws.send({
        action: "ConnectClient",
        targetClientId: clientId,
        messageData: {
          type: "SelectingLeader",
          randomValue,
        },
      });
    }
    function peerConnectionsManagerOnOfferAvailable(event) {
      const {
        detail: { clientId, offer },
      } = event;

      ws.send({
        action: "ConnectClient",
        targetClientId: clientId,
        messageData: offer,
      });
    }
    function peerConnectionsManagerOnAnswerAvailable(event) {
      const {
        detail: { clientId, answer },
      } = event;

      ws.send({
        action: "ConnectClient",
        targetClientId: clientId,
        messageData: answer,
      });
    }
    peerConnectionsManager.addEventListener(
      "clients",
      peerConnectionsManagerOnClients
    );
    peerConnectionsManager.addEventListener(
      "selectleader",
      peerConnectionsManagerOnSelectleader
    );
    peerConnectionsManager.addEventListener(
      "offeravailable",
      peerConnectionsManagerOnOfferAvailable
    );
    peerConnectionsManager.addEventListener(
      "answeravailable",
      peerConnectionsManagerOnAnswerAvailable
    );

    // === RoomStateSyncManager ===

    function roomStateSyncManagerOnState(event) {
      const { detail } = event;
      peerConnectionsManager.setClientIds(detail.clientIds);
    }
    roomStateSyncManager.addEventListener("state", roomStateSyncManagerOnState);
    roomStateSyncManager.start();

    // === WebSocketManager ===

    const wsOpenSubscriber = ws.openObserver.subscribe(() => {
      setConnectionStatus("Connected");
      ws.send({ action: "JoinRoom", roomId });
    });
    const wsCloseSubscriber = ws.closeObserver.subscribe(() => {
      setConnectionStatus("Disconnected");
    });
    const wsMessageSubscriber = ws.messageObserver.subscribe((detail) => {
      if (detail.isDelta) {
        switch (detail.type) {
          case "ClientJoin":
          case "ClientLeft":
            roomStateSyncManager.dispatchEvent(
              new CustomEvent("delta", { detail })
            );
            break;
          default:
            break;
        }
      } else {
        switch (detail.type) {
          case "CurrentClientId": {
            const { clientId } = detail;
            setCurrentClientId(clientId);
            peerConnectionsManager.setCurrentClientId(clientId);
            break;
          }
          case "ConnectClient": {
            const { fromClientId, messageData } = detail;
            peerConnectionsManager.dispatchEvent(
              new CustomEvent("connectclient", {
                detail: { fromClientId, messageData },
              })
            );
            break;
          }
          default: {
            break;
          }
        }
      }
    });
    ws.connect();

    console.groupEnd();
    return () => {
      console.group("Room cleanup");
      console.log(`useEffect() clean up. roomId = ${roomId}`);

      isStopped = true;

      ws.close();
      wsOpenSubscriber.unsubscribe();
      wsCloseSubscriber.unsubscribe();
      wsMessageSubscriber.unsubscribe();

      roomStateSyncManager.destroy();
      roomStateSyncManager.removeEventListener(
        "state",
        roomStateSyncManagerOnState
      );

      peerConnectionsManager.destroy();
      peerConnectionsManager.removeEventListener(
        "clients",
        peerConnectionsManagerOnClients
      );
      peerConnectionsManagerRef.current = null;

      console.groupEnd();
      console.groupEnd();
    };
  }, [roomId]);

  useEffect(() => {
    let localMediaStreamTmp = null;

    const getUserMediaSubscription = from(
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    ).subscribe({
      next: (mediaStream) => {
        localMediaStreamTmp = mediaStream;
        setLocalMediaStream(mediaStream);
        refLocalMediaStreamSubject.current.next(mediaStream);
      },
      error: (err) => {
        console.warn("Getting user media failed.", err);
      },
    });

    return () => {
      getUserMediaSubscription.unsubscribe();
      localMediaStreamTmp?.getTracks().forEach((track) => track.stop());
      setLocalMediaStream(null);
      refLocalMediaStreamSubject.current.next(null);
    };
  }, []);

  return (
    <div>
      <h1>
        Room ID: <code>{roomId}</code> ({connectionStatus})
      </h1>
      <h2>
        Current client ID: <code>{currentClientId}</code>
      </h2>
      <div className="Room_videos-container">
        {clients &&
          clients
            .toArray()
            .map(([clientId, client]) => (
              <ClientBox
                key={clientId}
                clientId={clientId}
                localMediaStream={localMediaStream}
                client={client}
              />
            ))}
      </div>
    </div>
  );
}
