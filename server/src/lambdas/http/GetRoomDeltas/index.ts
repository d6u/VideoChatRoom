import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Delta, DeltaType } from "shared-models";

import { getRoomDeltas } from "../../../utils/room-snapshots-utils";

function parseEvent(event: APIGatewayProxyEventV2) {
  const roomId = event.pathParameters!.roomId as string;
  let fromSeq = null;
  let toSeq = null;
  if (event.queryStringParameters?.fromSeq != null) {
    fromSeq = parseInt(event.queryStringParameters.fromSeq);
  }
  if (event.queryStringParameters?.toSeq != null) {
    toSeq = parseInt(event.queryStringParameters.toSeq);
  }
  return { roomId, fromSeq, toSeq };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log(event);
  const parsedParmas = parseEvent(event);
  console.log(parsedParmas);
  const { roomId, fromSeq, toSeq } = parsedParmas;

  if (fromSeq == null || toSeq == null) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing fromSeq or toSeq query params.",
      }),
    };
  }

  let response = null;
  try {
    response = await getRoomDeltas(roomId, fromSeq, toSeq);
  } catch (error) {
    console.error(error);
    return { statusCode: 500 };
  }

  console.log(response);

  if (response.Items == null || response.Count === 0) {
    return { statusCode: 404 };
  }

  const deltas: Delta[] = response.Items.map((item) => ({
    roomId: item.RoomId.S!,
    seq: parseInt(item.Seq.N!),
    type: item.Type.S as DeltaType,
    clientId: item.ClientId.S!,
  }));

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(deltas),
  };
};
