import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

import { getDynamoDbClient } from "./dynamo-db-utils";

const TABLE_NAME = process.env.TABLE_NAME_CLIENT_TO_ROOM;

export async function getClientToRoomPair(clientId: string) {
  const dynamoDbClient = getDynamoDbClient();

  return await dynamoDbClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        ClientId: { S: clientId },
      },
    })
  );
}

export async function createClientToRoomPair(clientId: string, roomId: string) {
  const dynamoDbClient = getDynamoDbClient();

  await dynamoDbClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        ClientId: { S: clientId },
        RoomId: { S: roomId },
      },
    })
  );
}

export async function deleteClientToRoomPair(clientId: string) {
  const dynamoDbClient = getDynamoDbClient();

  await dynamoDbClient.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        ClientId: { S: clientId },
      },
    })
  );
}
