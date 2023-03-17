import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME_ROOM_TO_CLIENTS;

export async function getRoomToClientsMap(dynamoDbClient, roomId) {
  return await dynamoDbClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        RoomId: { S: roomId },
      },
    })
  );
}

export async function createRoomToClientsPlaceholder(dynamoDbClient, roomId) {
  await dynamoDbClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        RoomId: { S: roomId },
      },
    })
  );
}

export async function addClientToRoom(dynamoDbClient, roomId, clientId) {
  await dynamoDbClient.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: {
        RoomId: { S: roomId },
      },
      // By default, UpdateItem will perform create the record if it doesn't
      // ready exist. By adding the ConditionExpression, we prevent creating new
      // record if roomId cannot be found.
      ConditionExpression: "attribute_exists(RoomId)",
      UpdateExpression: "ADD ClientIds :vals",
      ExpressionAttributeValues: {
        ":vals": { SS: [clientId] },
      },
      ReturnValues: "ALL_NEW",
    })
  );
}

export async function removeClientFromRoom(dynamoDbClient, roomId, clientId) {
  await dynamoDbClient.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: {
        RoomId: { S: roomId },
      },
      // By default, UpdateItem will perform create the record if it doesn't
      // ready exist. By adding the ConditionExpression, we prevent creating new
      // record if roomId cannot be found.
      ConditionExpression: "attribute_exists(RoomId)",
      UpdateExpression: "DELETE ClientIds :vals",
      ExpressionAttributeValues: {
        ":vals": { SS: [clientId] },
      },
    })
  );
}
