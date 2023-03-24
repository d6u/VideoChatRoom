import { getApiGatewayManagement } from "shared-utils";
import { postToClient } from "shared-utils/api-gateway-management-utils.js";

const apiGatewayManagementApi = getApiGatewayManagement(
  process.env.WEBSOCKET_API_ENDPOINT.replace("wss:", "https:")
);

function parseEvent(event) {
  const {
    requestContext: { routeKey, connectionId },
    body,
  } = event;
  const { toClientId, message } = JSON.parse(body);
  return {
    routeKey,
    connectionId,
    toClientId,
    message,
  };
}

export async function handler(event, context) {
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
  } catch (error) {
    if (error["$metadata"]?.httpStatusCode === 410) {
      console.warn(`found stale connection ${connectionId}`);
    } else {
      console.error(`posting to connection ${connectionId} failed`, error);
    }
  }

  return {
    statusCode: 200,
  };
}
