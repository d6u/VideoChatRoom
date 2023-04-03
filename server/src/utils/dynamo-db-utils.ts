import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

let dynamoDbClient: DynamoDBClient | null = null;

export function getDynamoDbClient() {
  if (dynamoDbClient == null) {
    dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION! });
  }
  return dynamoDbClient;
}
