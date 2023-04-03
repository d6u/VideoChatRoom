import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { nanoid } from "nanoid";

import { getDynamoDbClient } from "../../../utils/dynamo-db-utils";
import { createRoomSnapshot } from "../../../utils/room-snapshots-utils";
import { createRoomToClientsPlaceholder } from "../../../utils/room-to-clients-utils";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION!);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const roomId = nanoid();

  console.log(`Creating a new room ${roomId}.`);

  try {
    await createRoomSnapshot(dynamoDbClient, roomId);
  } catch (error) {
    console.error("Creating a new room failed.", error);
    return { statusCode: 500 };
  }

  try {
    await createRoomToClientsPlaceholder(dynamoDbClient, roomId);
  } catch (error) {
    console.error("Creating room to clients map failed.", error);
    return { statusCode: 500 };
  }

  console.log(`Creating a new room succeeded.`);

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ roomId }),
  };
};
