import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { WebSocketMessage } from "shared-models";

import {
  errorIsGoneException,
  postToClient,
} from "./api-gateway-management-utils";
import { getRoomToClientsMap } from "./room-to-clients-utils";

export async function postDataToRoom(
  dynamoDbClient: DynamoDBClient,
  apiGatewayManagementApi: ApiGatewayManagementApi,
  roomId: string,
  data: WebSocketMessage
) {
  const clientIds = await getClientIdsForBroadcasting(dynamoDbClient, roomId);
  await postToClients(apiGatewayManagementApi, clientIds!, data);
}

async function getClientIdsForBroadcasting(
  dynamoDbClient: DynamoDBClient,
  roomId: string
) {
  try {
    const response = await getRoomToClientsMap(dynamoDbClient, roomId);
    console.log(`Getting room ${roomId} succeeded.`, response);
    if (response.Item?.ClientIds != null) {
      return response.Item.ClientIds.SS;
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
  return [];
}

async function postToClients(
  apiGatewayManagementApi: ApiGatewayManagementApi,
  clientIds: string[],
  data: WebSocketMessage
) {
  const postToConnectionCalls = clientIds.map(async (connectionId) => {
    try {
      await postToClient(apiGatewayManagementApi, connectionId, data);
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
