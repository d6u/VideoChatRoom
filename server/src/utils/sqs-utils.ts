import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SqsMessageBody } from "shared-models";

let sqsClient: SQSClient | null = null;

export function getSqsClient() {
  if (sqsClient == null) {
    sqsClient = new SQSClient({ region: process.env.AWS_REGION! });
  }
  return sqsClient;
}

export async function sendActionToRoomActionsQueue(
  groupId: string,
  dedupId: string,
  body: SqsMessageBody
) {
  const sqsClient = getSqsClient();

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: process.env.ROOM_ACTIONS_QUEUE_URL!,
      MessageGroupId: groupId,
      MessageDeduplicationId: dedupId,
      MessageBody: JSON.stringify(body),
    })
  );
}
