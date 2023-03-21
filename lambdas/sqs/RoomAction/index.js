import { getDynamoDbClient, getApiGatewayManagement } from "shared-utils";
import { getRoomToClientsMap } from "shared-utils/room-to-clients-utils.js";
import {
  applyClientJoinAction,
  applyClientLeftAction,
} from "shared-utils/room-snapshots-utils.js";
import { postToClient } from "shared-utils/api-gateway-management-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION);
const apiGatewayManagementApi = getApiGatewayManagement(
  process.env.WEBSOCKET_API_ENDPOINT.replace("wss:", "https:")
);

export async function handler(event, context) {
  console.log("Handling event.", event);

  await Promise.all(
    event.Records.map((record) =>
      processRecord(record)
        .then(() => {
          console.log("Process record succeeded.");
        })
        .catch((error) => {
          console.error("Process record error.", error);
        })
    )
  );

  return {};
}

async function processRecord(record) {
  console.log("Processing record.", record);

  const body = JSON.parse(record.body);

  switch (body.action) {
    case "ClientJoin":
      await handleClientJoinAction(body);
      break;
    case "ClientLeft":
      await handleClientLeftAction(body);
      break;
    default:
      break;
  }
}

async function handleClientJoinAction(body) {
  const { roomId, clientId } = body;
  try {
    const seq = await applyClientJoinAction(dynamoDbClient, roomId, clientId);
    if (seq != null) {
      const clientIds = await getClientIdsForBroadcasting(
        dynamoDbClient,
        roomId
      );
      await postToClients(clientIds, roomId, {
        isDelta: true,
        type: "ClientJoin",
        seq,
        clientId,
      });
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
}

async function handleClientLeftAction(body) {
  const { roomId, clientId } = body;
  try {
    const seq = await applyClientLeftAction(dynamoDbClient, roomId, clientId);
    if (seq != null) {
      const clientIds = await getClientIdsForBroadcasting(
        dynamoDbClient,
        roomId
      );
      await postToClients(clientIds, roomId, {
        isDelta: true,
        type: "ClientLeft",
        seq,
        clientId,
      });
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
}

async function getClientIdsForBroadcasting(dynamoDbClient, roomId) {
  try {
    const response = await getRoomToClientsMap(dynamoDbClient, roomId);
    console.log(`Getting room ${roomId} succeeded.`, response);
    if (
      response != null &&
      response.Item != null &&
      response.Item.ClientIds != null
    ) {
      return response.Item.ClientIds.SS;
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
  return [];
}

async function postToClients(clientIds, roomId, data) {
  const postToConnectionCalls = clientIds.map(async (connectionId) => {
    try {
      await postToClient(apiGatewayManagementApi, connectionId, data);
    } catch (error) {
      if (error["$metadata"]?.httpStatusCode === 410) {
        console.warn(`found stale connection ${connectionId}`);
      } else {
        console.error(`posting to connection ${connectionId} failed`, error);
      }
    }
  });

  await Promise.all(postToConnectionCalls);
}
