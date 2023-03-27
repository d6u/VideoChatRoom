import { useCallback, useState } from "react";

import { createRoom } from "../../apis/Api";

export default function Root() {
  const [roomId, setRoomId] = useState("");

  const onCreateNewRoom = useCallback(async () => {
    const { roomId } = await createRoom();
    window.history.pushState(null, "", `/${roomId}`);
  }, []);

  return (
    <div>
      <div>
        <button onClick={onCreateNewRoom}>Create New Room</button>
      </div>
      <div>
        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
        />
        <button
          onClick={() => {
            if (roomId !== "") {
              window.history.pushState(null, "", `/${roomId}`);
            }
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}
