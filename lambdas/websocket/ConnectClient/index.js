import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

function parseEvent(event) {
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const {
    requestContext: { connectionId },
    body,
  } = event;
  const { targetClientId, messageData } = JSON.parse(body);
  return {
    endpoint,
    connectionId,
    targetClientId,
    messageData,
  };
}

export async function handler(event, context) {
  console.log("handling event", event);

  const { endpoint, connectionId, targetClientId, messageData } =
    parseEvent(event);

  const apiGatewayManagementApi = new ApiGatewayManagementApi({ endpoint });

  try {
    await apiGatewayManagementApi.postToConnection({
      ConnectionId: targetClientId,
      Data: JSON.stringify({
        type: "ConnectClient",
        fromClientId: connectionId,
        messageData,
      }),
    });
  } catch (error) {
    console.error(`Error posting to client ${targetClientId}.`, error);
  }
}
