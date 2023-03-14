import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

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

    let response2;

    try {
      response2 = await dynamoDbClient.send(
        new GetItemCommand({
          TableName: process.env.ROOMS_TABLE_NAME,
          Key: {
            roomId: { S: roomId },
          },
        })
      );
    } catch (err) {
      console.error(`Getting room "${roomId}" failed.`, err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error_type: ERROR_TYPES.DELETE_CLIENT_ERROR,
          error: err,
        }),
      };
    }

    if (response2.Item.clients != null) {
      const clientIds = response2.Item.clients.SS;

      const apigwManagementApi = new ApiGatewayManagementApi({
        endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
      });

      const postToConnectionCalls = clientIds.map(async (connectionId2) => {
        try {
          await apigwManagementApi.postToConnection({
            ConnectionId: connectionId2,
            Data: JSON.stringify({
              type: "ClientLeft",
              clientId: connectionId,
            }),
          });
        } catch (err) {
          if (err["$metadata"].httpStatusCode === 410) {
            console.log(`Found stale connection, deleting "${connectionId2}."`);

            try {
              await dynamoDbClient.send(
                new UpdateItemCommand({
                  TableName: process.env.ROOMS_TABLE_NAME,
                  Key: {
                    roomId: { S: roomId },
                  },
                  UpdateExpression: "DELETE clients :vals",
                  ExpressionAttributeValues: {
                    ":vals": { SS: [connectionId2] },
                  },
                })
              );
            } catch (err) {
              console.error(
                `Deleting "${connectionId2}" from room failed.`,
                err
              );
            }
          } else {
            console.error(
              `Posting to connection "${connectionId2}" failed.`,
              err
            );
          }
        }
      });

      await Promise.all(postToConnectionCalls);
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
