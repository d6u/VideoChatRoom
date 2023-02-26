import { useCallback, useContext, useState } from "react";
import * as RealtimeDatabase from "firebase/database";
import DatabaseContext from "./utils/DatabaseContext";

export default function Root() {
  const database = useContext(DatabaseContext);
  const [roomKey, setRoomKey] = useState("");

  const onCreateNewRoom = useCallback(async () => {
    const roomsRef = RealtimeDatabase.ref(database, "rooms");
    const roomRef = RealtimeDatabase.push(roomsRef);
    await RealtimeDatabase.set(roomRef, {
      timestamp: RealtimeDatabase.serverTimestamp(),
    });
    window.history.pushState(null, "", `/${roomRef.key}`);
  }, [database]);

  return (
    <div>
      <div>
        <button onClick={onCreateNewRoom}>Create New Room</button>
      </div>
      <div>
        <input
          type="text"
          placeholder="Enter room key"
          value={roomKey}
          onChange={(event) => setRoomKey(event.target.value)}
        />
        <button
          onClick={() => {
            if (roomKey !== "") {
              window.history.pushState(null, "", `/${roomKey}`);
            }
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}
