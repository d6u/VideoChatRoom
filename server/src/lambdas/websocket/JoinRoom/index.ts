import { ApiGatewayManagementApiServiceException } from "@aws-sdk/client-apigatewaymanagementapi";
import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import {
  SqsMessageBodyAction,
  WebSocketActionJoinRoom,
  WebSocketMessageCurrentClientId,
  WebSocketMessageType,
} from "shared-models";

import {
  errorIsGoneException,
  postToClient,
} from "../../../utils/api-gateway-management-utils.js";
import { createClientToRoomPair } from "../../../utils/client-to-room-utils.js";
import { addClientToRoom } from "../../../utils/room-to-clients-utils.js";
import { sendActionToRoomActionsQueue } from "../../../utils/sqs-utils.js";

function parseEvent(event: APIGatewayProxyWebsocketEventV2) {
  const action = JSON.parse(event.body!) as WebSocketActionJoinRoom;
  return {
    requestId: event.requestContext.requestId,
    connectionId: event.requestContext.connectionId,
    roomId: action.roomId,
  };
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
  console.log("Receiving event", event);

  const { requestId, connectionId, roomId } = parseEvent(event);

  // Return current connection ID as client ID to the current WebSocket client.

  const message: WebSocketMessageCurrentClientId = {
    type: WebSocketMessageType.CurrentClientId,
    clientId: connectionId,
  };

  postToClient(connectionId, message).catch(
    (error: ApiGatewayManagementApiServiceException) => {
      if (errorIsGoneException(error)) {
        console.warn(`found stale connection ${connectionId}`);
      } else {
        console.error(`posting to connection ${connectionId} failed`, error);
      }
    }
  );

  // === Add connection ID to room to client map ===

  console.log(`Adding client ID ${connectionId} to room "${roomId}".`);
  let addClientIdToRoomResponse = null;
  try {
    addClientIdToRoomResponse = await addClientToRoom(roomId, connectionId);
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      console.error(`Room "${roomId}" not found.`);
      return { statusCode: 404 };
    } else {
      console.error(
        `Adding client ID ${connectionId} to room "${roomId}" failed.`,
        error
      );
      return { statusCode: 500 };
    }
  }
  console.log(
    `Adding client ID ${connectionId} to room "${roomId}" succeeded.`
  );

  // === Create client to room pair ===

  try {
    await createClientToRoomPair(connectionId, roomId);
  } catch (error) {
    console.error(
      `Creating client "${connectionId}" to room "${roomId}" failed.`,
      error
    );
    return { statusCode: 500 };
  }

  // === Send message to queue ===

  try {
    await sendActionToRoomActionsQueue(roomId, requestId, {
      action: SqsMessageBodyAction.ClientJoin,
      roomId,
      clientId: connectionId,
    });
  } catch (error) {
    console.error(`sending action to queue failed.`, error);
    return { statusCode: 500 };
  }

  return { statusCode: 200 };
};
