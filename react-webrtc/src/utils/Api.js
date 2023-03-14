import endpoints from "../api_endpoints.json";

async function createRoom() {
  const response = await fetch(`${endpoints.http_endpoint_url}/rooms`, {
    method: "POST",
    mode: "cors",
  });

  const body = await response.json();

  return body.roomId;
}

const Api = {
  createRoom,
};

export default Api;
