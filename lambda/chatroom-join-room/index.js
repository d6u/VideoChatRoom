import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

async function getRoom(roomId) {
  try {
    const response = await client.send(
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

async function postToClients(endpoint, clientIds, data) {
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

        await client.send(
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
      } else {
        console.error(`Posting to connection "${connectionId}" failed.`, err);
      }
    }
  });

  await Promise.all(postToConnectionCalls);
}

export const handler = async (event, context) => {
  console.log("Receiving event", event);

  const {
    requestContext: { connectionId },
    body,
  } = event;

  const { roomId } = JSON.parse(body);

  const [response, err] = await getRoom(roomId);

  if (err != null) {
    console.error(`Getting room "${roomId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }

  if (response == null || response.Item == null) {
    console.error(`Could not find room "${roomId}".`);
    return {
      statusCode: 404,
    };
  }

  console.log(`Getting room "${roomId}" succeeded.`, response);

  if (response.Item.clients != null) {
    try {
      await postToClients(
        `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
        response.Item.clients.SS,
        JSON.stringify({ hello: "World" })
      );
    } catch (err) {
      return { statusCode: 500, body: err };
    }
  }

  try {
    await client.send(
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
  } catch (err) {
    console.error(`Updating room "${roomId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }

  console.log(`Updating room "${roomId}" succeeded.`);
  return {
    statusCode: 200,
  };
};
