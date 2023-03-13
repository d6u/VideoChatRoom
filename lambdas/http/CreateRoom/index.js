import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { nanoid } from "nanoid";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  const roomId = nanoid();

  console.log(`Creating a new room, room ID is "${roomId}"`);

  const command = new PutItemCommand({
    TableName: process.env.ROOMS_TABLE_NAME,
    Item: {
      roomId: { S: roomId },
    },
  });

  try {
    await client.send(command);
  } catch (err) {
    console.error("Creating a new room failed.", err);

    return {
      statusCode: 500,
      body: JSON.stringify(err),
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
