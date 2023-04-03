import { WebSocketMessage } from "shared-models";

import {
  errorIsGoneException,
  postToClient,
} from "./api-gateway-management-utils";
import { getRoomToClientsMap } from "./room-to-clients-utils";

export async function postDataToRoom(roomId: string, data: WebSocketMessage) {
  const clientIds = await getClientIdsForBroadcasting(roomId);
  await postToClients(clientIds!, data);
}

async function getClientIdsForBroadcasting(roomId: string) {
  try {
    const response = await getRoomToClientsMap(roomId);
    console.log(`Getting room ${roomId} succeeded.`, response);
    if (response.Item?.ClientIds != null) {
      return response.Item.ClientIds.SS;
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
  return [];
}

async function postToClients(clientIds: string[], data: WebSocketMessage) {
  const postToConnectionCalls = clientIds.map(async (connectionId) => {
    try {
      await postToClient(connectionId, data);
    } catch (error: any) {
      if (errorIsGoneException(error)) {
        console.warn(`found stale connection ${connectionId}`);
      } else {
        console.error(`posting to connection ${connectionId} failed`, error);
      }
    }
  });

  await Promise.all(postToConnectionCalls);
}
