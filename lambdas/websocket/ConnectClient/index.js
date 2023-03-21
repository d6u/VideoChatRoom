import { getApiGatewayManagement } from "shared-utils";
import { postToClient } from "shared-utils/api-gateway-management-utils.js";

const apiGatewayManagementApi = getApiGatewayManagement(
  process.env.WEBSOCKET_API_ENDPOINT.replace("wss:", "https:")
);

function parseEvent(event) {
  const {
    requestContext: { connectionId },
    body,
  } = event;
  const { targetClientId, messageData } = JSON.parse(body);
  return {
    connectionId,
    targetClientId,
    messageData,
  };
}

export async function handler(event, context) {
  console.log("handling event", event);

  const { connectionId, targetClientId, messageData } = parseEvent(event);

  try {
    await postToClient(apiGatewayManagementApi, targetClientId, {
      type: "ConnectClient",
      fromClientId: connectionId,
      messageData,
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
