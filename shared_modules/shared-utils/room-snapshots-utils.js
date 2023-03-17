import {
  GetItemCommand,
  PutItemCommand,
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

  if (response != null && response.Item != null) {
    await dynamoDbClient.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.TABLE_NAME_ROOM_DELTAS,
              Item: {
                RoomId: { S: roomId },
                Seq: { N: String(parseInt(response.Item.Seq.N) + 1) },
                Action: { S: "ClientJoin" },
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
                ":incr": { N: "1" },
              },
            },
          },
        ],
      })
    );

    return response.Item.Seq.N + 1;
  }
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

  if (response != null && response.Item != null) {
    await dynamoDbClient.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.TABLE_NAME_ROOM_DELTAS,
              Item: {
                RoomId: { S: roomId },
                Seq: { N: String(parseInt(response.Item.Seq.N) + 1) },
                Action: { S: "ClientLeft" },
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
                ":incr": { N: "1" },
              },
            },
          },
        ],
      })
    );
  }
}
