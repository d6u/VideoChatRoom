import { Delta, Snapshot } from "shared-models";

import { HTTP_ENDPOINT_URL } from "../constants";

export async function createRoom(): Promise<
  | {
      hasError: true;
      roomData: null;
    }
  | {
      hasError: false;
      roomData: { roomId: string };
    }
> {
  const response = await fetch(`${HTTP_ENDPOINT_URL}/rooms`, {
    method: "POST",
    mode: "cors",
  });

  if (response.ok) {
    return { hasError: false, roomData: await response.json() };
  } else {
    return { hasError: true, roomData: null };
  }
}

type GetRoomSnapsotResponse =
  | {
      hasError: true;
      snapshot: null;
    }
  | {
      hasError: false;
      snapshot: Snapshot;
    };

export async function getRoomSnapshot(
  roomId: string
): Promise<GetRoomSnapsotResponse> {
  const response = await fetch(
    `${HTTP_ENDPOINT_URL}/rooms/${roomId}/snapshot`,
    {
      method: "GET",
      mode: "cors",
    }
  );

  if (response.ok) {
    return { hasError: false, snapshot: await response.json() };
  } else {
    return { hasError: true, snapshot: null };
  }
}

export function isSnapshotOkResponse(
  response: GetRoomSnapsotResponse
): response is { hasError: false; snapshot: Snapshot } {
  return !response.hasError;
}

export async function getRoomDeltas(
  roomId: string,
  fromSeq: number,
  toSeq: number
): Promise<Delta[]> {
  const response = await fetch(
    `${HTTP_ENDPOINT_URL}/rooms/${roomId}/deltas?fromSeq=${fromSeq}&toSeq=${toSeq}`,
    {
      method: "GET",
      mode: "cors",
    }
  );

  return await response.json();
}
