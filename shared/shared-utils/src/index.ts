import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";

export function getApiGatewayManagement(endpoint: string) {
  return new ApiGatewayManagementApi({ endpoint });
}

export function getDynamoDbClient(region: string) {
  return new DynamoDBClient({ region });
}

export function getSqsClient(region: string) {
  return new SQSClient({ region });
}

export function exhaustiveMatchingGuard(_: never): never {
  throw new Error(`Should never reach here.`);
}
