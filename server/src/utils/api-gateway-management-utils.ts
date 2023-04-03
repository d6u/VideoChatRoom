import {
  ApiGatewayManagementApi,
  GoneException,
  PostToConnectionCommandOutput,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { WebSocketMessage } from "shared-models";

const encoder = new TextEncoder();

export function getApiGatewayManagement(endpoint: string) {
  return new ApiGatewayManagementApi({ endpoint });
}

export async function postToClient(
  apiGatewayManagementApi: ApiGatewayManagementApi,
  connectionId: string,
  data: WebSocketMessage
) {
  await (apiGatewayManagementApi.postToConnection({
    ConnectionId: connectionId,
    Data: encoder.encode(JSON.stringify(data)),
  }) as Promise<PostToConnectionCommandOutput>);
}

export function errorIsGoneException(error: any): error is GoneException {
  // Or error["$metadata"]?.httpStatusCode === 410
  return error.name === "GoneException";
}
