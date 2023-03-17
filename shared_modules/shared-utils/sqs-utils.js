import { SendMessageCommand } from "@aws-sdk/client-sqs";

export async function sendActionToRoomActionsQueue(
  sqsClient,
  groupId,
  dedupId,
  body
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
