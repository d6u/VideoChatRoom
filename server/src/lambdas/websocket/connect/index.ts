import { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
  context
) => {
  return { statusCode: 200 };
};
