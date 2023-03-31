import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

export async function postToClient(
  apiGatewayManagementApi: ApiGatewayManagementApi,
  connectionId: string,
  data: any
) {
  await (apiGatewayManagementApi.postToConnection({
    ConnectionId: connectionId,
    Data: JSON.stringify(data),
  }) as Promise<any>);
}
