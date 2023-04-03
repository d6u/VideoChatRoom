import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import { SqsMessageBodyAction } from "shared-models";

import {
  deleteClientToRoomPair,
  getClientToRoomPair,
} from "../../../utils/client-to-room-utils";
import { removeClientFromRoom } from "../../../utils/room-to-clients-utils";
import {
  getSqsClient,
  sendActionToRoomActionsQueue,
} from "../../../utils/sqs-utils";

const sqsClient = getSqsClient(process.env.AWS_REGION!);

function parseEvent(event: APIGatewayProxyWebsocketEventV2) {
  return {
    requestId: event.requestContext.requestId,
    connectionId: event.requestContext.connectionId,
  };
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
  console.log("Handling event: ", event);

  const { requestId, connectionId } = parseEvent(event);

  let response = null;
  try {
    response = await getClientToRoomPair(connectionId);
  } catch (error) {
    console.error(`Getting client "${connectionId}" failed.`, error);
    return { statusCode: 500 };
  }

  console.log("client to room pair: ", response);

  if (response != null && response.Item!.RoomId != null) {
    const roomId = response.Item!.RoomId.S!;

    try {
      await removeClientFromRoom(roomId, connectionId);
    } catch (error) {
      console.error(
        `Deleting client "${connectionId}" from room ${roomId} failed.`,
        error
      );
      return { statusCode: 500 };
    }

    try {
      await sendActionToRoomActionsQueue(sqsClient, roomId, requestId, {
        action: SqsMessageBodyAction.ClientLeft,
        roomId,
        clientId: connectionId,
      });
    } catch (error) {
      console.error(`Sending action to queue failed.`, error);
      return { statusCode: 500 };
    }
  }

  try {
    await deleteClientToRoomPair(connectionId);
  } catch (error: any) {
    console.error(`Deleting client "${connectionId}" failed.`, error);
    return { statusCode: 500 };
  }

  return { statusCode: 200 };
};
