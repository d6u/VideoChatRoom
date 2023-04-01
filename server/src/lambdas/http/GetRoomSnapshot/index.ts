import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDynamoDbClient } from "shared-utils";
import { getRoomSnapshot } from "shared-utils/dist/room-snapshots-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION!);

function parseEvent(event: APIGatewayEvent) {
  return { roomId: event.pathParameters!.roomId as string };
}

export async function handler(
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> {
  console.log(event);
  const { roomId } = parseEvent(event);

  let response = null;
  try {
    response = await getRoomSnapshot(dynamoDbClient, roomId);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  console.log(response);

  if (response == null || response.Item == null) {
    return {
      statusCode: 404,
      body: "",
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      roomId: response.Item.RoomId.S,
      seq: parseInt(response.Item.Seq.N!),
      clientIds:
        response.Item.ClientIds != null ? response.Item.ClientIds.SS : [],
    }),
  };
}
