import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Snapshot } from "shared-models";

import { getRoomSnapshot } from "../../../utils/room-snapshots-utils.js";

function parseEvent(event: APIGatewayProxyEventV2) {
  return { roomId: event.pathParameters!.roomId as string };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log(event);
  const { roomId } = parseEvent(event);

  let response = null;
  try {
    response = await getRoomSnapshot(roomId);
  } catch (error) {
    console.error(error);
    return { statusCode: 500 };
  }

  console.log(response);

  if (response.Item == null) {
    return { statusCode: 404 };
  }

  const snapshot: Snapshot = {
    roomId: response.Item.RoomId!.S!,
    seq: parseInt(response.Item.Seq!.N!),
    clientIds: response.Item.ClientIds?.SS ?? [],
  };

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(snapshot),
  };
};
