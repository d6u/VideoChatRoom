import {
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";

export async function createRoomSnapshot(dynamoDbClient, roomId) {
  await dynamoDbClient.send(
    new PutItemCommand({
      TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
      Item: {
        RoomId: { S: roomId },
        // Number type must be sent as string.
        Seq: { N: "0" },
        // Cannot specify clientIds, because string set cannot be empty.
      },
    })
  );
}

export async function getRoomSnapshot(dynamoDbClient, roomId) {
  return await dynamoDbClient.send(
    new GetItemCommand({
      TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
      Key: {
        RoomId: { S: roomId },
      },
    })
  );
}

export async function getRoomDeltas(dynamoDbClient, roomId, fromSeq, toSeq) {
  return await dynamoDbClient.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME_ROOM_DELTAS,
      KeyConditionExpression:
        "RoomId = :roomId AND Seq BETWEEN :fromSeq AND :toSeq",
      ExpressionAttributeValues: {
        ":roomId": { S: roomId },
        // Number type must be sent as string.
        ":fromSeq": { N: String(fromSeq) },
        ":toSeq": { N: String(toSeq) },
      },
    })
  );
}

export async function applyClientJoinAction(dynamoDbClient, roomId, clientId) {
  const response = await dynamoDbClient.send(
    new GetItemCommand({
      TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
      Key: {
        RoomId: { S: roomId },
      },
    })
  );

  console.log(response);

  if (response == null || response.Item == null) {
    return null;
  }

  const newSeq = parseInt(response.Item.Seq.N) + 1;

  await dynamoDbClient.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.TABLE_NAME_ROOM_DELTAS,
            Item: {
              RoomId: { S: roomId },
              // Number type must be sent as string.
              Seq: { N: String(newSeq) },
              Type: { S: "ClientJoin" },
              ClientId: { S: clientId },
            },
          },
        },
        {
          Update: {
            TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
            Key: {
              RoomId: { S: roomId },
            },
            UpdateExpression: "ADD ClientIds :vals SET Seq = Seq + :incr",
            ExpressionAttributeValues: {
              ":vals": { SS: [clientId] },
              // Number type must be sent as string.
              ":incr": { N: "1" },
            },
          },
        },
      ],
    })
  );

  return newSeq;
}

export async function applyClientLeftAction(dynamoDbClient, roomId, clientId) {
  const response = await dynamoDbClient.send(
    new GetItemCommand({
      TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
      Key: {
        RoomId: { S: roomId },
      },
    })
  );

  console.log(response);

  if (response == null || response.Item == null) {
    return null;
  }

  const newSeq = parseInt(response.Item.Seq.N) + 1;

  await dynamoDbClient.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.TABLE_NAME_ROOM_DELTAS,
            Item: {
              RoomId: { S: roomId },
              // Number type must be sent as string.
              Seq: { N: String(newSeq) },
              Type: { S: "ClientLeft" },
              ClientId: { S: clientId },
            },
          },
        },
        {
          Update: {
            TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
            Key: {
              RoomId: { S: roomId },
            },
            UpdateExpression: "DELETE ClientIds :vals SET Seq = Seq + :incr",
            ExpressionAttributeValues: {
              ":vals": { SS: [clientId] },
              // Number type must be sent as string.
              ":incr": { N: "1" },
            },
          },
        },
      ],
    })
  );

  return newSeq;
}
