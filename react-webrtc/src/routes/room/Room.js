import { useEffect, useRef, useState } from "react";
import { Set } from "immutable";
import { from, filter, BehaviorSubject } from "rxjs";
import Logger from "../../utils/Logger";
import webSocketManager from "../../utils/WebSocketManager";
import RoomStateSyncManager from "../../utils/RoomStateSyncManager";
import ClientBox from "./ClientBox";

const logger = new Logger("Room");

export default function Room({ roomId }) {
  const refLocalMediaStreamSubject = useRef(null);

  if (refLocalMediaStreamSubject.current == null) {
    refLocalMediaStreamSubject.current = new BehaviorSubject(null);
  }

  const [wsStatus, setWsStatus] = useState("Connecting");
  const [localClientId, setCurrentClientId] = useState(null);
  const [clientIds, setClientIds] = useState(Set());

  useEffect(() => {
    logger.log("[0] useEffect setup");
    // Due to useEffect in React dev build executes twice on component mount,
    // we delay WebSocket connection by a small amount of time, to fix an issue
    // in Safari failing to connect when connection is close immediately before
    // connection.
    const timeoutHandler = setTimeout(() => {
      webSocketManager.connect();
    }, 200);

    return () => {
      logger.log("[0] useEffect cleanup");
      clearTimeout(timeoutHandler);
      webSocketManager.disconnect();
    };
  }, []);

  useEffect(() => {
    logger.log("[1] useEffect setup");

    const subscriptions = [];

    const roomStateSyncManager = new RoomStateSyncManager(
      roomId,
      webSocketManager.messagesSubject
    );

    subscriptions.push(
      webSocketManager.openObserver.subscribe(() => {
        setWsStatus("Connected");
        webSocketManager.send({ action: "JoinRoom", roomId });
      }),
      webSocketManager.closeObserver.subscribe(() => {
        setWsStatus("Disconnected");
      }),
      webSocketManager.messagesSubject
        .pipe(filter((m) => !m.isDelta && m.type === "CurrentClientId"))
        .subscribe(({ clientId }) => setCurrentClientId(clientId)),
      roomStateSyncManager.snapshotsObservable.subscribe((snapshot) => {
        logger.log(
          `roomStateSyncManager.snapshotsObservable ${JSON.stringify(
            snapshot.toJS(),
            null,
            4
          )}`
        );
        setClientIds(snapshot.clientIds);
      })
    );

    logger.log("[1] useEffect setup end");
    return () => {
      logger.log("[1] useEffect cleanup");
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      roomStateSyncManager.destroy();
      logger.log("[1] useEffect cleanup end");
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
              localMediaStreamSubject={refLocalMediaStreamSubject.current}
              localClientId={localClientId}
            />
          ))
          .toArray()}
      </div>
    </div>
  );
}
