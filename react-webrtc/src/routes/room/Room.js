import { from, BehaviorSubject } from "rxjs";
import { useEffect, useRef, useState } from "react";
import WebSocketManager from "../../utils/WebSocketManager";
import RoomStateSyncManager from "../../utils/RoomStateSyncManager";
import PeerConnectionsManager from "../../utils/PeerConnectionsManager";
import ClientBox from "./ClientBox";

export default function Room(props) {
  const { roomId } = props;

  const refLocalMediaStreamSubject = useRef(new BehaviorSubject(null));

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

    const pcsm = new PeerConnectionsManager(refLocalMediaStreamSubject.current);
    const roomStateSyncManager = new RoomStateSyncManager(roomId);
    const ws = new WebSocketManager();

    // === PeerConnectionsManager ===

    const pcsmClientsSubscription = pcsm.clientsSubject.subscribe(setClients);
    const pcsmSelectLeaderSubscription = pcsm.selectLeaderSubject.subscribe(
      ({ clientId, randomValue }) => {
        ws.send({
          action: "ConnectClient",
          targetClientId: clientId,
          messageData: {
            type: "SelectingLeader",
            randomValue,
          },
        });
      }
    );
    const pcsmOfferSubscription = pcsm.offerSubject.subscribe(
      ({ clientId, offer }) => {
        ws.send({
          action: "ConnectClient",
          targetClientId: clientId,
          messageData: offer,
        });
      }
    );
    const pcsmAnswerSubscription = pcsm.answerSubject.subscribe(
      ({ clientId, answer }) => {
        ws.send({
          action: "ConnectClient",
          targetClientId: clientId,
          messageData: answer,
        });
      }
    );
    const pcsmIceSubscription = pcsm.iceSubject.subscribe(
      ({ clientId, candidate }) => {
        ws.send({
          action: "ConnectClient",
          targetClientId: clientId,
          messageData: candidate,
        });
      }
    );

    // === RoomStateSyncManager ===

    function roomStateSyncManagerOnState(event) {
      const { detail } = event;
      pcsm.setClientIds(detail.clientIds);
    }
    roomStateSyncManager.addEventListener("state", roomStateSyncManagerOnState);
    roomStateSyncManager.start();

    // === WebSocketManager ===

    const wsOpenSubscription = ws.openObserver.subscribe(() => {
      setConnectionStatus("Connected");
      ws.send({ action: "JoinRoom", roomId });
    });
    const wsCloseSubscription = ws.closeObserver.subscribe(() => {
      setConnectionStatus("Disconnected");
    });
    const wsMessageSubscription = ws.messageObserver.subscribe((data) => {
      if (data.isDelta) {
        switch (data.type) {
          case "ClientJoin":
          case "ClientLeft":
            roomStateSyncManager.dispatchEvent(
              new CustomEvent("delta", { detail: data })
            );
            break;
          default:
            break;
        }
      } else {
        switch (data.type) {
          case "CurrentClientId": {
            const { clientId } = data;
            setCurrentClientId(clientId);
            pcsm.setCurrentClientId(clientId);
            break;
          }
          case "ConnectClient": {
            const { fromClientId, messageData } = data;
            pcsm.dispatchEvent(
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
      wsOpenSubscription.unsubscribe();
      wsCloseSubscription.unsubscribe();
      wsMessageSubscription.unsubscribe();

      roomStateSyncManager.destroy();
      roomStateSyncManager.removeEventListener(
        "state",
        roomStateSyncManagerOnState
      );

      pcsm.destroy();
      pcsmClientsSubscription.unsubscribe();
      pcsmSelectLeaderSubscription.unsubscribe();
      pcsmOfferSubscription.unsubscribe();
      pcsmAnswerSubscription.unsubscribe();
      pcsmIceSubscription.unsubscribe();

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
