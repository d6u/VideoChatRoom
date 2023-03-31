import endpoints from "../api_endpoints.json";
import { RawDelta } from "../models/Delta";
import { RawSnapshot } from "../models/Snapshot";

export async function createRoom(): Promise<{ roomId: string }> {
  const response = await fetch(`${endpoints.http_endpoint_url}/rooms`, {
    method: "POST",
    mode: "cors",
  });

  return await response.json();
}

export async function getRoomSnapshot(roomId: string): Promise<RawSnapshot> {
  const response = await fetch(
    `${endpoints.http_endpoint_url}/rooms/${roomId}/snapshot`,
    {
      method: "GET",
      mode: "cors",
    }
  );

  return await response.json();
}

export async function getRoomDeltas(
  roomId: string,
  fromSeq: number,
  toSeq: number
): Promise<RawDelta[]> {
  const response = await fetch(
    `${endpoints.http_endpoint_url}/rooms/${roomId}/deltas?fromSeq=${fromSeq}&toSeq=${toSeq}`,
    {
      method: "GET",
      mode: "cors",
    }
  );

  return await response.json();
}
