import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { getDynamoDbClient } from "../../../utils/dynamo-db-utils";
import { getRoomDeltas } from "../../../utils/room-snapshots-utils";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION!);

function parseEvent(event: APIGatewayProxyEventV2) {
  const roomId = event.pathParameters!.roomId as string;
  let fromSeq = null;
  let toSeq = null;
  if (event.queryStringParameters?.fromSeq != null) {
    fromSeq = parseInt(event.queryStringParameters.fromSeq);
  }
  if (event.queryStringParameters?.toSeq != null) {
    toSeq = parseInt(event.queryStringParameters.toSeq);
  }
  return { roomId, fromSeq, toSeq };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  console.log(event);
  const parsedParmas = parseEvent(event);
  console.log(parsedParmas);
  const { roomId, fromSeq, toSeq } = parsedParmas;

  if (fromSeq == null || toSeq == null) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing fromSeq or toSeq query params.",
      }),
    };
  }

  let response = null;
  try {
    response = await getRoomDeltas(dynamoDbClient, roomId, fromSeq, toSeq);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  console.log(response);

  if (response == null || response.Items == null || response.Count === 0) {
    return {
      statusCode: 404,
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(
      response.Items.map((item) => ({
        roomId: item.RoomId.S,
        seq: parseInt(item.Seq.N!),
        type: item.Type.S,
        clientId: item.ClientId.S,
      }))
    ),
  };
}
