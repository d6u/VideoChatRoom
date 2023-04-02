import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import { getDynamoDbClient, getSqsClient } from "shared-utils";
import {
  deleteClientToRoomPair,
  getClientToRoomPair,
} from "shared-utils/dist/client-to-room-utils.js";
import { removeClientFromRoom } from "shared-utils/dist/room-to-clients-utils.js";
import { sendActionToRoomActionsQueue } from "shared-utils/dist/sqs-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION!);
const sqsClient = getSqsClient(process.env.AWS_REGION!);

function parseEvent(event: APIGatewayProxyWebsocketEventV2) {
  const {
    requestContext: { requestId, connectionId },
  } = event;
  return { requestId, connectionId };
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
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

  if (response != null && response.Item!.RoomId != null) {
    const roomId = response.Item!.RoomId.S!;

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
  } catch (error: any) {
    console.error(`Deleting client "${connectionId}" failed.`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  return { statusCode: 200 };
};