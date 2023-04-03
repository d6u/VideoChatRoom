import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { WebSocketMessage } from "shared-models";

const encoder = new TextEncoder();

export async function postToClient(
  apiGatewayManagementApi: ApiGatewayManagementApi,
  connectionId: string,
  data: WebSocketMessage
) {
  await (apiGatewayManagementApi.postToConnection({
    ConnectionId: connectionId,
    Data: encoder.encode(JSON.stringify(data)),
  }) as Promise<any>);
}
