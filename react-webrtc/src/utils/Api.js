import endpoints from "../api_endpoints.json";

export async function createRoom() {
  const response = await fetch(`${endpoints.http_endpoint_url}/rooms`, {
    method: "POST",
    mode: "cors",
  });

  return await response.json();
}

export async function getRoomSnapshot(roomId) {
  const response = await fetch(
    `${endpoints.http_endpoint_url}/rooms/${roomId}/snapshot`,
    {
      method: "GET",
      mode: "cors",
    }
  );

  return await response.json();
}

export async function getRoomDeltas(roomId, fromSeq, toSeq) {
  const response = await fetch(
    `${endpoints.http_endpoint_url}/rooms/${roomId}/deltas?fromSeq=${fromSeq}&toSeq=${toSeq}`,
    {
      method: "GET",
      mode: "cors",
    }
  );

  return await response.json();
}
