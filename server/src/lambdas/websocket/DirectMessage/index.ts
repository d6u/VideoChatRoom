import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import {
  WebSocketActionDirectMessage,
  WebSocketMessageType,
} from "shared-models";

import {
  errorIsGoneException,
  postToClient,
} from "../../../utils/api-gateway-management-utils";

function parseEvent(event: APIGatewayProxyWebsocketEventV2) {
  const message = JSON.parse(event.body!) as WebSocketActionDirectMessage;
  return {
    connectionId: event.requestContext.connectionId,
    toClientId: message.toClientId,
    message: message.message,
  };
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
  console.log("handling event", event);

  const { connectionId: fromClientId, toClientId, message } = parseEvent(event);

  try {
    await postToClient(toClientId, {
      isDelta: false,
      type: WebSocketMessageType.DirectMessage,
      fromClientId,
      message,
    });
  } catch (error: any) {
    if (errorIsGoneException(error)) {
      console.warn(`found stale connection ${toClientId}`);
    } else {
      console.error(`posting to connection ${toClientId} failed`, error);
    }
  }

  return {
    statusCode: 200,
  };
};
