import { getDynamoDbClient } from "shared-utils";
import { getRoomDeltas } from "shared-utils/room-snapshots-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION);

function parseEvent(event) {
  const {
    pathParameters: { roomId },
    queryStringParameters,
  } = event;
  let fromSeq = null;
  let toSeq = null;
  if (queryStringParameters != null) {
    if (queryStringParameters.fromSeq != null) {
      fromSeq = parseInt(queryStringParameters.fromSeq);
    }
    if (queryStringParameters.toSeq != null) {
      toSeq = parseInt(queryStringParameters.toSeq);
    }
  }
  return { roomId, fromSeq, toSeq };
}

export async function handler(event) {
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
        seq: parseInt(item.Seq.N),
        type: item.Type.S,
        clientId: item.ClientId.S,
      }))
    ),
  };
}
