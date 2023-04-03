import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SqsMessageBody } from "shared-models";

export async function sendActionToRoomActionsQueue(
  sqsClient: SQSClient,
  groupId: string,
  dedupId: string,
  body: SqsMessageBody
) {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: process.env.ROOM_ACTIONS_QUEUE_URL!,
      MessageGroupId: groupId,
      MessageDeduplicationId: dedupId,
      MessageBody: JSON.stringify(body),
    })
  );
}
