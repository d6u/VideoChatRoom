import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  ClientJoinSqsMessageBody,
  ClientLeftSqsMessageBody,
  DeltaType,
  SqsMessageBody,
  SqsMessageBodyAction,
  WebSocketMessageType,
} from "shared-models";
import { exhaustiveMatchingGuard } from "shared-utils";

import {
  applyClientJoinAction,
  applyClientLeftAction,
} from "../../../utils/room-snapshots-utils.js";
import { postDataToRoom } from "../../../utils/room-utils.js";

export async function handler(event: SQSEvent) {
  console.log("Handling event.", event);

  await Promise.all(
    event.Records.map((record) =>
      processRecord(record)
        .then(() => {
          console.log("Process record succeeded.");
        })
        .catch((error) => {
          console.error("Process record error.", error);
        })
    )
  );

  return {};
}

async function processRecord(record: SQSRecord) {
  console.log("Processing record.", record);

  const body = JSON.parse(record.body) as SqsMessageBody;

  switch (body.action) {
    case SqsMessageBodyAction.ClientJoin:
      await handleClientJoinAction(body);
      break;
    case SqsMessageBodyAction.ClientLeft:
      await handleClientLeftAction(body);
      break;
    default:
      exhaustiveMatchingGuard(body);
  }
}

async function handleClientJoinAction({
  roomId,
  clientId,
}: ClientJoinSqsMessageBody) {
  try {
    const seq = await applyClientJoinAction(roomId, clientId);
    if (seq != null) {
      await postDataToRoom(roomId, {
        type: WebSocketMessageType.Delta,
        delta: {
          type: DeltaType.ClientJoin,
          seq,
          clientId,
        },
      });
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
}

async function handleClientLeftAction({
  roomId,
  clientId,
}: ClientLeftSqsMessageBody) {
  try {
    const seq = await applyClientLeftAction(roomId, clientId);
    if (seq != null) {
      await postDataToRoom(roomId, {
        type: WebSocketMessageType.Delta,
        delta: {
          type: DeltaType.ClientLeft,
          seq,
          clientId,
        },
      });
    }
  } catch (error) {
    console.error("Something went wrong.", error);
  }
}
