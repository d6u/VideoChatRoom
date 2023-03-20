import { useEffect, useRef, useState } from "react";
import { Set } from "immutable";
import { from, BehaviorSubject, filter } from "rxjs";
import WebSocketManager from "../../utils/WebSocketManager";
import RoomStateSyncManager from "../../utils/RoomStateSyncManager";
import ClientBox from "./ClientBox";

export default function Room({ roomId }) {
  const refLocalMediaStreamSubject = useRef(new BehaviorSubject(null));

  const [wsStatus, setWsStatus] = useState("Disconnected");
  const [localClientId, setCurrentClientId] = useState(null);
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [clientIds, setClientIds] = useState(Set());

  useEffect(() => {
    console.group("Room");
    console.group("Room setup");
    console.log(`useEffect(). roomId = ${roomId}`);

    const subscriptions = [];

    setWsStatus("Connecting");

    const ws = new WebSocketManager();
    const roomStateSyncManager = new RoomStateSyncManager(
      roomId,
      ws.webSocketObservable
    );

    subscriptions.push(
      roomStateSyncManager.snapshotsObservable.subscribe((snapshot) => {
        console.log("-->", snapshot.toJS());
        setClientIds(snapshot.clientIds);
      })
    );

    subscriptions.push(
      ws.openObserver.subscribe(() => {
        setWsStatus("Connected");
        ws.send({ action: "JoinRoom", roomId });
      })
    );

    subscriptions.push(
      ws.closeObserver.subscribe(() => {
        setWsStatus("Disconnected");
      })
    );

    subscriptions.push(
      ws.webSocketObservable
        .pipe(filter((m) => !m.isDelta && m.type === "CurrentClientId"))
        .subscribe(({ clientId }) => setCurrentClientId(clientId))
    );

    //       case "ConnectClient": {
    //         const { fromClientId, messageData } = data;
    //         pcsm.dispatchEvent(
    //           new CustomEvent("connectclient", {
    //             detail: { fromClientId, messageData },
    //           })
    //         );
    //         break;
    //       }

    console.groupEnd();
    return () => {
      console.group("Room cleanup");
      console.log(`useEffect() clean up. roomId = ${roomId}`);

      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }

      roomStateSyncManager.destroy();

      console.groupEnd();
      console.groupEnd();
    };
  }, [roomId]);

  useEffect(() => {
    const subscriptions = [];

    let mediaStreamTmp = null;

    subscriptions.push(
      from(
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      ).subscribe({
        next: (mediaStream) => {
          mediaStreamTmp = mediaStream;
          setLocalMediaStream(mediaStream);
          refLocalMediaStreamSubject.current.next(mediaStream);
        },
        error: (err) => {
          console.warn("Getting user media failed.", err);
        },
      })
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }

      mediaStreamTmp?.getTracks().forEach((track) => track.stop());
      setLocalMediaStream(null);
      refLocalMediaStreamSubject.current.next(null);
    };
  }, []);

  return (
    <div>
      <h1>
        Room ID: <code>{roomId}</code> ({wsStatus})
      </h1>
      <h2>
        Current client ID: <code>{localClientId}</code>
      </h2>
      <div className="Room_videos-container">
        {clientIds
          .map((id) => (
            <ClientBox
              key={id}
              clientId={id}
              localMediaStream={localMediaStream}
              localClientId={localClientId}
            />
          ))
          .toArray()}
      </div>
    </div>
  );
}
