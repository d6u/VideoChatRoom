import { useCallback, useEffect, useRef, useState } from "react";
import { Set } from "immutable";
import { from, filter, BehaviorSubject } from "rxjs";
import WebSocketManager from "../../utils/WebSocketManager";
import RoomStateSyncManager from "../../utils/RoomStateSyncManager";
import ClientBox from "./ClientBox";

export default function Room({ roomId }) {
  const refWs = useRef(null);
  const refLocalMediaStreamSubject = useRef(null);

  if (refWs.current == null) {
  }
  if (refLocalMediaStreamSubject.current == null) {
    refLocalMediaStreamSubject.current = new BehaviorSubject(null);
  }

  const [wsStatus, setWsStatus] = useState("Disconnected");
  const [localClientId, setCurrentClientId] = useState(null);
  const [clientIds, setClientIds] = useState(Set());

  useEffect(() => {
    console.group("Room");
    console.group("Room setup");

    const subscriptions = [];

    refWs.current = new WebSocketManager();
    setWsStatus("Connecting");

    const roomStateSyncManager = new RoomStateSyncManager(
      roomId,
      refWs.current.webSocketObservable
    );

    subscriptions.push(
      roomStateSyncManager.snapshotsObservable.subscribe((snapshot) =>
        setClientIds(snapshot.clientIds)
      ),
      refWs.current.openObserver.subscribe(() => {
        setWsStatus("Connected");
        refWs.current.send({ action: "JoinRoom", roomId });
      }),
      refWs.current.closeObserver.subscribe(() => {
        setWsStatus("Disconnected");
      }),
      refWs.current.webSocketObservable
        .pipe(filter((m) => !m.isDelta && m.type === "CurrentClientId"))
        .subscribe(({ clientId }) => setCurrentClientId(clientId))
    );

    console.groupEnd();
    return () => {
      console.group("Room cleanup");

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
          console.log("Getting user media succeeded.", mediaStream);
          mediaStreamTmp = mediaStream;
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
      refLocalMediaStreamSubject.current.next(null);
    };
  }, []);

  const onWsMessage = useCallback((message) => {
    refWs.current.send(message);
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
              wsMessageObserver={refWs.current.webSocketObservable}
              onWsMessage={onWsMessage}
              localMediaStreamSubject={refLocalMediaStreamSubject.current}
              localClientId={localClientId}
            />
          ))
          .toArray()}
      </div>
    </div>
  );
}
