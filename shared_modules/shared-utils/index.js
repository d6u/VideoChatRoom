import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";

export function getApiGatewayManagement(endpoint) {
  return new ApiGatewayManagementApi({ endpoint });
}

export function getDynamoDbClient(region) {
  return new DynamoDBClient({ region });
}

export function getSqsClient(region) {
  return new SQSClient({ region });
}
