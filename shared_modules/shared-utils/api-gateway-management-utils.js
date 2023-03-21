export async function postToClient(
  apiGatewayManagementApi,
  connectionId,
  data
) {
  await apiGatewayManagementApi.postToConnection({
    ConnectionId: connectionId,
    Data: JSON.stringify(data),
  });
}
