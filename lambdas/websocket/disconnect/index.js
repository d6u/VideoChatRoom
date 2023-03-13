import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

const ERROR_TYPES = {
  DELETE_CLIENT_ERROR: "DELETE_CLIENT_ERROR",
};

export async function handler(event, context) {
  const {
    requestContext: { connectionId },
    body,
  } = event;

  let response;

  try {
    response = await dynamoDbClient.send(
      new GetItemCommand({
        TableName: process.env.CLIENTS_TABLE_NAME,
        Key: {
          clientId: { S: connectionId },
        },
      })
    );
  } catch (err) {
    console.error(`Getting client "${connectionId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.DELETE_CLIENT_ERROR,
        error: err,
      }),
    };
  }

  if (response.Item.roomId != null) {
    const roomId = response.Item.roomId.S;

    try {
      await dynamoDbClient.send(
        new UpdateItemCommand({
          TableName: process.env.ROOMS_TABLE_NAME,
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
      console.error(
        `Deleting client "${connectionId}" from room ${roomId} failed.`,
        err
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          error_type: ERROR_TYPES.DELETE_CLIENT_ERROR,
          error: err,
        }),
      };
    }
  }

  try {
    await dynamoDbClient.send(
      new DeleteItemCommand({
        TableName: process.env.CLIENTS_TABLE_NAME,
        Key: {
          clientId: { S: connectionId },
        },
      })
    );
  } catch (err) {
    console.error(`Deleting client "${connectionId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.DELETE_CLIENT_ERROR,
        error: err,
      }),
    };
  }

  return { statusCode: 200 };
}
