import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { getApiGatewayManagement, getDynamoDbClient } from "shared-utils";
import { postToClient } from "shared-utils/dist/api-gateway-management-utils.js";
import {
  applyClientJoinAction,
  applyClientLeftAction,
} from "shared-utils/dist/room-snapshots-utils";
import { getRoomToClientsMap } from "shared-utils/dist/room-to-clients-utils";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION!);
const apiGatewayManagementApi = getApiGatewayManagement(
  process.env.WEBSOCKET_API_ENDPOINT!.replace("wss:", "https:")
);

export async function handler(event: SQSEvent) {
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

async function processRecord(record: SQSRecord) {
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

async function handleClientJoinAction({
  roomId,
  clientId,
}: {
  roomId: string;
  clientId: string;
}) {
  try {
    const seq = await applyClientJoinAction(dynamoDbClient, roomId, clientId);
    if (seq != null) {
      const clientIds = await getClientIdsForBroadcasting(
        dynamoDbClient,
        roomId
      );
      await postToClients(clientIds!, roomId, {
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

async function handleClientLeftAction({
  roomId,
  clientId,
}: {
  roomId: string;
  clientId: string;
}) {
  try {
    const seq = await applyClientLeftAction(dynamoDbClient, roomId, clientId);
    if (seq != null) {
      const clientIds = await getClientIdsForBroadcasting(
        dynamoDbClient,
        roomId
      );
      await postToClients(clientIds!, roomId, {
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

async function getClientIdsForBroadcasting(
  dynamoDbClient: DynamoDBClient,
  roomId: string
) {
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

async function postToClients(clientIds: string[], roomId: string, data: any) {
  const postToConnectionCalls = clientIds.map(async (connectionId) => {
    try {
      await postToClient(apiGatewayManagementApi, connectionId, data);
    } catch (error: any) {
      if (error["$metadata"]?.httpStatusCode === 410) {
        console.warn(`found stale connection ${connectionId}`);
      } else {
        console.error(`posting to connection ${connectionId} failed`, error);
      }
    }
  });

  await Promise.all(postToConnectionCalls);
}
