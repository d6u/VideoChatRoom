import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export function getDynamoDbClient(region: string) {
  return new DynamoDBClient({ region });
}
