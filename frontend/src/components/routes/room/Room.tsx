import { Set } from "immutable";
import { useEffect, useState } from "react";
import {
  BehaviorSubject,
  Observable,
  Subscription,
  filter,
  from,
  timer,
} from "rxjs";

import RoomStateSyncManager from "../../../apis/RoomStateSyncManager";
import webSocketManager from "../../../apis/WebSocketManager";
import { CurrentClientIdMessage } from "../../../models/webSocketMessages";
import Logger from "../../../utils/Logger";
import { useConst } from "../../hooks";
import ClientBox from "./ClientBox";
import "./Room.css";

const logger = new Logger("Room");

export default function Room({ roomId }: { roomId: string }) {
  const localMediaStreamSubject = useConst(
    () => new BehaviorSubject<MediaStream | null>(null)
  );

  const [wsStatus, setWsStatus] = useState("Connecting");
  const [localClientId, setCurrentClientId] = useState<string | null>(null);
  const [clientIds, setClientIds] = useState(Set<string>());

  useEffect(() => {
    logger.debug("[0] useEffect setup");

    const subscription = new Subscription();

    // Due to useEffect in React dev build executes twice on component mount,
    // we delay WebSocket connection by a small amount of time, to fix an issue
    // in Safari failing to connect when connection is close immediately before
    // connection.
    subscription.add(
      timer(200).subscribe(() => {
        webSocketManager.connect();
      })
    );

    return () => {
      logger.debug("[0] useEffect cleanup");
      webSocketManager.disconnect();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    logger.debug("[1] useEffect setup");

    const subscription = new Subscription();

    const roomStateSyncManager = new RoomStateSyncManager(
      roomId,
      webSocketManager.messagesSubject
    );

    subscription.add(
      webSocketManager.openObserver.subscribe(() => {
        setWsStatus("Connected");
        webSocketManager.send({ action: "JoinRoom", roomId });
      })
    );

    subscription.add(
      webSocketManager.closeObserver.subscribe(() => {
        setWsStatus("Disconnected");
      })
    );

    subscription.add(
      (
        webSocketManager.messagesSubject.pipe(
          filter((m) => !m.isDelta && m.type === "CurrentClientId")
        ) as Observable<CurrentClientIdMessage>
      ).subscribe(({ clientId }) => setCurrentClientId(clientId))
    );

    subscription.add(
      roomStateSyncManager.roomStatesObservable!.subscribe((roomState) => {
        logger.log(
          `room state updated`,
          JSON.stringify(roomState.toJS(), null, 4)
        );
        setClientIds(roomState.clientIds);
      })
    );

    logger.debug("[1] useEffect setup end");

    return () => {
      logger.debug("[1] useEffect cleanup");

      subscription.unsubscribe();
      roomStateSyncManager.destroy();

      logger.debug("[1] useEffect cleanup end");
    };
  }, [roomId]);

  useEffect(() => {
    const subscription = new Subscription();

    let tmpMediaStream: MediaStream | null = null;

    subscription.add(
      from(
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      ).subscribe({
        next: (mediaStream) => {
          logger.log("Getting user media succeeded.", mediaStream);
          tmpMediaStream = mediaStream;
          localMediaStreamSubject.next(mediaStream);
        },
        error: (err) => {
          logger.warn("Getting user media failed.", err);
        },
      })
    );

    return () => {
      tmpMediaStream?.getTracks().forEach((track) => track.stop());
      localMediaStreamSubject.next(null);
      subscription.unsubscribe();
    };
  }, [localMediaStreamSubject]);

  return (
    <div>
      <pre>
        Room ID: {roomId}
        <br />
        WebSocket: {wsStatus}
        <br />
        Current client ID: {localClientId}
      </pre>
      <div className="Room_videos-container">
        {clientIds
          .map((id) => (
            <ClientBox
              key={id}
              clientId={id}
              localMediaStreamSubject={localMediaStreamSubject}
              localClientId={localClientId}
            />
          ))
          .toArray()}
      </div>
    </div>
  );
}
