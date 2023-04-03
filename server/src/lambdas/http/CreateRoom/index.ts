import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { nanoid } from "nanoid";

import { createRoomSnapshot } from "../../../utils/room-snapshots-utils";
import { createRoomToClientsPlaceholder } from "../../../utils/room-to-clients-utils";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const roomId = nanoid();

  console.log(`Creating a new room ${roomId}.`);

  try {
    await createRoomSnapshot(roomId);
  } catch (error) {
    console.error("Creating a new room failed.", error);
    return { statusCode: 500 };
  }

  try {
    await createRoomToClientsPlaceholder(roomId);
  } catch (error) {
    console.error("Creating room to clients map failed.", error);
    return { statusCode: 500 };
  }

  console.log(`Creating a new room succeeded.`);

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ roomId }),
  };
};
