import { useCallback, useState } from "react";

import { createRoom } from "../../apis/Api";

enum LoadingState {
  INITIAL = "INITIAL",
  LOADING = "LOADING",
  ERROR = "ERROR",
}

export default function Root() {
  const [roomId, setRoomId] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [loadingState, setLoadingState] = useState(LoadingState.INITIAL);

  const onCreateNewRoom = useCallback(async () => {
    if (isDisabled) {
      return;
    }

    setIsDisabled(true);
    setLoadingState(LoadingState.LOADING);

    const { hasError, roomData } = await createRoom();

    setIsDisabled(false);

    if (hasError) {
      setLoadingState(LoadingState.ERROR);
    } else {
      window.history.pushState(null, "", `/${roomData.roomId}`);
    }
  }, [isDisabled]);

  return (
    <div>
      <div>
        <button disabled={isDisabled} onClick={onCreateNewRoom}>
          Create New Room ({loadingState})
        </button>
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
