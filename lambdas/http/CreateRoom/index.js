import { nanoid } from "nanoid";
import { getDynamoDbClient } from "shared-utils";
import { createRoomSnapshot } from "shared-utils/room-snapshots-utils.js";
import { createRoomToClientsPlaceholder } from "shared-utils/room-to-clients-utils.js";

const dynamoDbClient = getDynamoDbClient(process.env.AWS_REGION);

export const handler = async (event) => {
  const roomId = nanoid();

  console.log(`Creating a new room ${roomId}.`);

  try {
    await createRoomSnapshot(dynamoDbClient, roomId);
  } catch (error) {
    console.error("Creating a new room failed.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }

  try {
    await createRoomToClientsPlaceholder(dynamoDbClient, roomId);
  } catch (error) {
    console.error("Creating room to clients map failed.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
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
