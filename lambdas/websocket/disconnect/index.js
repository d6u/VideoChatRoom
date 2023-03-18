import { getDynamoDbClient, getSqsClient } from "shared-utils";
import { removeClientFromRoom } from "shared-utils/room-to-clients-utils.js";
import {
  getClientToRoomPair,
  deleteClientToRoomPair,
} from "shared-utils/client-to-room-utils.js";
import { sendActionToRoomActionsQueue } from "shared-utils/sqs-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION);
const sqsClient = getSqsClient(process.env.AWS_REGION);

function parseEvent(event) {
  const {
    requestContext: { requestId, connectionId },
  } = event;
  return { requestId, connectionId };
}

export async function handler(event, context) {
  console.log("Handling event: ", event);

  const { requestId, connectionId } = parseEvent(event);

  let response = null;
  try {
    response = await getClientToRoomPair(dynamoDbClient, connectionId);
  } catch (error) {
    console.error(`Getting client "${connectionId}" failed.`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  console.log("client to room pair: ", response);

  if (response != null && response.Item.RoomId != null) {
    const roomId = response.Item.RoomId.S;

    try {
      await removeClientFromRoom(dynamoDbClient, roomId, connectionId);
    } catch (error) {
      console.error(
        `Deleting client "${connectionId}" from room ${roomId} failed.`,
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({ error }),
      };
    }

    try {
      await sendActionToRoomActionsQueue(sqsClient, roomId, requestId, {
        action: "ClientLeft",
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
  }

  try {
    await deleteClientToRoomPair(dynamoDbClient, connectionId);
  } catch (error) {
    console.error(`Deleting client "${connectionId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  return { statusCode: 200 };
}
