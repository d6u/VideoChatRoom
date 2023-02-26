import { useContext, useEffect, useState } from "react";
import * as RealtimeDatabase from "firebase/database";
import DatabaseContext from "./utils/DatabaseContext";
import RoomInner from "./RoomInner";

export default function Room(props) {
  const database = useContext(DatabaseContext);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoomExist, setIsRoomExist] = useState(false);

  useEffect(() => {
    let isStopped = false;
    const roomRef = RealtimeDatabase.ref(database, `rooms/${props.roomKey}`);
    RealtimeDatabase.get(roomRef).then((roomSnap) => {
      if (isStopped) {
        return;
      }
      setIsRoomExist(roomSnap.exists());
      setIsLoading(false);
    });

    return () => {
      isStopped = true;
    };
  }, [database, props.roomKey]);

  if (isLoading) {
    return <h1>Loading...</h1>;
  }

  if (!isRoomExist) {
    return (
      <h1>
        Room <pre>{props.roomKey}</pre> does not exist.
      </h1>
    );
  }

  return <RoomInner roomKey={props.roomKey} />;
}
