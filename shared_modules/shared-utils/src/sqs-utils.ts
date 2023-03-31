import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export async function sendActionToRoomActionsQueue(
  sqsClient: SQSClient,
  groupId: string,
  dedupId: string,
  body: any
) {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: process.env.ROOM_ACTIONS_QUEUE_URL,
      MessageGroupId: groupId,
      MessageDeduplicationId: dedupId,
      MessageBody: JSON.stringify(body),
    })
  );
}
