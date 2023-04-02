import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import {
  getApiGatewayManagement,
  getDynamoDbClient,
  getSqsClient,
} from "shared-utils";
import { postToClient } from "shared-utils/dist/api-gateway-management-utils.js";
import { createClientToRoomPair } from "shared-utils/dist/client-to-room-utils.js";
import { addClientToRoom } from "shared-utils/dist/room-to-clients-utils.js";
import { sendActionToRoomActionsQueue } from "shared-utils/dist/sqs-utils.js";

const ERROR_TYPES = {
  RoomNotFoundError: "RoomNotFoundError",
  AddClientIdToRoomError: "AddClientIdToRoomError",
  GetRoomError: "GetRoomError",
  PostToClientsError: "PostToClientsError",
  UpdateClientError: "UpdateClientError",
};

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION!);
const sqsClient = getSqsClient(process.env.AWS_REGION!);
const apiGatewayManagementApi = getApiGatewayManagement(
  process.env.WEBSOCKET_API_ENDPOINT!.replace("wss:", "https:")
);

function parseEvent(event: APIGatewayProxyWebsocketEventV2) {
  const {
    requestContext: { requestId, connectionId },
    body,
  } = event;
  const { roomId } = JSON.parse(body!) as { roomId: string };
  return {
    requestId,
    connectionId,
    roomId,
  };
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
  console.log("Receiving event", event);

  const { requestId, connectionId, roomId } = parseEvent(event);

  // Return current connection ID as client ID to the current WebSocket client.

  postToClient(apiGatewayManagementApi, connectionId, {
    isDelta: false,
    type: "CurrentClientId",
    clientId: connectionId,
  }).catch((error) => {
    if (error["$metadata"]?.httpStatusCode === 410) {
      console.warn(`found stale connection ${connectionId}`);
    } else {
      console.error(`posting to connection ${connectionId} failed`, error);
    }
  });

  // === Add connection ID to room to client map ===

  console.log(`Adding client ID ${connectionId} to room "${roomId}".`);
  let addClientIdToRoomResponse = null;
  try {
    addClientIdToRoomResponse = await addClientToRoom(
      dynamoDbClient,
      roomId,
      connectionId
    );
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      console.error(`Room "${roomId}" not found.`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          errorType: ERROR_TYPES.RoomNotFoundError,
        }),
      };
    } else {
      console.error(
        `Adding client ID ${connectionId} to room "${roomId}" failed.`,
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          errorType: ERROR_TYPES.AddClientIdToRoomError,
          error,
        }),
      };
    }
  }
  console.log(
    `Adding client ID ${connectionId} to room "${roomId}" succeeded.`
  );

  // === Create client to room pair ===

  try {
    await createClientToRoomPair(dynamoDbClient, connectionId, roomId);
  } catch (error) {
    console.error(
      `Creating client "${connectionId}" to room "${roomId}" failed.`,
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  // === Send message to queue ===

  try {
    await sendActionToRoomActionsQueue(sqsClient, roomId, requestId, {
      action: "ClientJoin",
      roomId,
      clientId: connectionId,
    });
  } catch (error) {
    console.error(`Sending action to queue failed.`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  return {
    statusCode: 200,
  };
};
