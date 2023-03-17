import { getDynamoDbClient, getSqsClient } from "shared-utils";
import { addClientToRoom } from "shared-utils/room-to-clients-utils.js";
import { sendActionToRoomActionsQueue } from "shared-utils/sqs-utils.js";
import { createClientToRoomPair } from "shared-utils/client-to-room-utils.js";

const ERROR_TYPES = {
  RoomNotFoundError: "RoomNotFoundError",
  AddClientIdToRoomError: "AddClientIdToRoomError",
  GetRoomError: "GetRoomError",
  PostToClientsError: "PostToClientsError",
  UpdateClientError: "UpdateClientError",
};

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION);
const sqsClient = getSqsClient(process.env.AWS_REGION);

function parseEvent(event) {
  const {
    requestContext: { requestId, connectionId },
    body,
  } = event;
  const { roomId } = JSON.parse(body);
  return {
    requestId,
    connectionId,
    roomId,
  };
}

export async function handler(event, context) {
  console.log("Receiving event", event);

  const { requestId, connectionId, roomId } = parseEvent(event);

  // === Add connection ID to room to client map ===

  console.log(`Adding client ID ${connectionId} to room "${roomId}".`);
  let addClientIdToRoomResponse = null;
  try {
    addClientIdToRoomResponse = await addClientToRoom(
      dynamoDbClient,
      roomId,
      connectionId
    );
  } catch (error) {
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
      connectionId,
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
}
