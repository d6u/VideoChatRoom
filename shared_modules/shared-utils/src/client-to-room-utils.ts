import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME_CLIENT_TO_ROOM;

export async function getClientToRoomPair(
  dynamoDbClient: DynamoDBClient,
  clientId: string
) {
  return await dynamoDbClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        ClientId: { S: clientId },
      },
    })
  );
}

export async function createClientToRoomPair(
  dynamoDbClient: DynamoDBClient,
  clientId: string,
  roomId: string
) {
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

export async function deleteClientToRoomPair(
  dynamoDbClient: DynamoDBClient,
  clientId: string
) {
  await dynamoDbClient.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        ClientId: { S: clientId },
      },
    })
  );
}
