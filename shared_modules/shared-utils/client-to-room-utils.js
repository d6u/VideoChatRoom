import {
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME_CLIENT_TO_ROOM;

export async function getClientToRoomPair(dynamoDbClient, clientId) {
  return await dynamoDbClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        ClientId: { S: clientId },
      },
    })
  );
}

export async function createClientToRoomPair(dynamoDbClient, clientId, roomId) {
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

export async function deleteClientToRoomPair(dynamoDbClient, clientId) {
  await dynamoDbClient.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        ClientId: { S: clientId },
      },
    })
  );
}
