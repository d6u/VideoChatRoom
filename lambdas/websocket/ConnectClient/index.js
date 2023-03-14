import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const ERROR_TYPES = {
  PostToClientsError: "PostToClientsError",
};

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

export const handler = async (event, context) => {
  console.log("Receiving event", event);
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
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.PostToClientsError,
        error,
      }),
    };
  }

  return {
    statusCode: 200,
  };
};
