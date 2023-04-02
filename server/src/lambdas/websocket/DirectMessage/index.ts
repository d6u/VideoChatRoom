import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import { getApiGatewayManagement } from "shared-utils";
import { postToClient } from "shared-utils/dist/api-gateway-management-utils.js";

const apiGatewayManagementApi = getApiGatewayManagement(
  process.env.WEBSOCKET_API_ENDPOINT!.replace("wss:", "https:")
);

function parseEvent(event: APIGatewayProxyWebsocketEventV2) {
  const {
    requestContext: { routeKey, connectionId },
    body,
  } = event;
  const { toClientId, message } = JSON.parse(body!) as {
    toClientId: string;
    message: string;
  };
  return {
    routeKey,
    connectionId,
    toClientId,
    message,
  };
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
  console.log("handling event", event);

  const {
    routeKey,
    connectionId: fromClientId,
    toClientId,
    message,
  } = parseEvent(event);

  try {
    await postToClient(apiGatewayManagementApi, toClientId, {
      isDelta: false,
      type: routeKey,
      fromClientId,
      message,
    });
  } catch (error: any) {
    if (error["$metadata"]?.httpStatusCode === 410) {
      console.warn(`found stale connection ${toClientId}`);
    } else {
      console.error(`posting to connection ${toClientId} failed`, error);
    }
  }

  return {
    statusCode: 200,
  };
};
