import { getDynamoDbClient } from "shared-utils";
import { getRoomSnapshot } from "shared-utils/room-snapshots-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION);

function parseEvent(event) {
  const {
    pathParameters: { roomId },
  } = event;
  return { roomId };
}

export async function handler(event) {
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
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      roomId: response.Item.RoomId.S,
      seq: parseInt(response.Item.Seq.N),
      clientIds:
        response.Item.ClientIds != null ? response.Item.ClientIds.SS : [],
    }),
  };
}
