import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

export async function getRoom(roomId) {
  try {
    const response = await dynamoDbClient.send(
      new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          roomId: { S: roomId },
        },
      })
    );

    return [response, null];
  } catch (err) {
    return [null, err];
  }
}

export async function postToClients(endpoint, clientIds, roomId, data) {
  const apigwManagementApi = new ApiGatewayManagementApi({ endpoint });

  const postToConnectionCalls = clientIds.map(async (connectionId) => {
    try {
      await apigwManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: data,
      });
    } catch (err) {
      if (err["$metadata"].httpStatusCode === 410) {
        console.log(`Found stale connection, deleting "${connectionId}."`);

        try {
          await dynamoDbClient.send(
            new UpdateItemCommand({
              TableName: process.env.TABLE_NAME,
              Key: {
                roomId: { S: roomId },
              },
              UpdateExpression: "DELETE clients :vals",
              ExpressionAttributeValues: {
                ":vals": { SS: [connectionId] },
              },
            })
          );
        } catch (err) {
          console.error(`Deleting "${connectionId}" from room failed.`, err);
        }
      } else {
        console.error(`Posting to connection "${connectionId}" failed.`, err);
      }
    }
  });

  await Promise.all(postToConnectionCalls);
}

export async function updateClient(connectionId, roomId) {
  await dynamoDbClient.send(
    new UpdateItemCommand({
      TableName: process.env.CLIENTS_TABLE_NAME,
      Key: {
        clientId: { S: connectionId },
      },
      UpdateExpression: "SET roomId = :val",
      ExpressionAttributeValues: {
        ":val": { S: roomId },
      },
    })
  );
}

export async function updateRoom(roomId, connectionId) {
  await dynamoDbClient.send(
    new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        roomId: { S: roomId },
      },
      UpdateExpression: "ADD clients :vals",
      ExpressionAttributeValues: {
        ":vals": { SS: [connectionId] },
      },
    })
  );
}
