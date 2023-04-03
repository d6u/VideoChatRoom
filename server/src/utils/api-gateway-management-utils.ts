import {
  ApiGatewayManagementApi,
  GoneException,
  PostToConnectionCommandOutput,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { WebSocketMessage } from "shared-models";

const encoder = new TextEncoder();

let apiGatewayManagementApi: ApiGatewayManagementApi | null = null;

export function getApiGatewayManagement() {
  if (apiGatewayManagementApi == null) {
    apiGatewayManagementApi = new ApiGatewayManagementApi({
      endpoint: process.env.WEBSOCKET_API_ENDPOINT!.replace("wss:", "https:"),
    });
  }
  return apiGatewayManagementApi;
}

export async function postToClient(
  connectionId: string,
  data: WebSocketMessage
) {
  const apiGatewayManagementApi = getApiGatewayManagement();

  await (apiGatewayManagementApi.postToConnection({
    ConnectionId: connectionId,
    Data: encoder.encode(JSON.stringify(data)),
  }) as Promise<PostToConnectionCommandOutput>);
}

export function errorIsGoneException(error: any): error is GoneException {
  // Or error["$metadata"]?.httpStatusCode === 410
  return error.name === "GoneException";
}
