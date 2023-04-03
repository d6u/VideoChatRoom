import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

import { getDynamoDbClient } from "./dynamo-db-utils";

const TABLE_NAME = process.env.TABLE_NAME_ROOM_TO_CLIENTS;

export async function getRoomToClientsMap(roomId: string) {
  const dynamoDbClient = getDynamoDbClient();

  return await dynamoDbClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        RoomId: { S: roomId },
      },
    })
  );
}

export async function createRoomToClientsPlaceholder(roomId: string) {
  const dynamoDbClient = getDynamoDbClient();

  await dynamoDbClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        RoomId: { S: roomId },
      },
    })
  );
}

export async function addClientToRoom(roomId: string, clientId: string) {
  const dynamoDbClient = getDynamoDbClient();

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

export async function removeClientFromRoom(roomId: string, clientId: string) {
  const dynamoDbClient = getDynamoDbClient();

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
