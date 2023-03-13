import { postToClients, getRoom, updateClient, updateRoom } from "./util.js";

const ERROR_TYPES = {
  GET_ROOM_ERROR: "GET_ROOM_ERROR",
  ROOM_NOT_FOUND_ERROR: "ROOM_NOT_FOUND_ERROR",
  POST_TO_CLIENTS_ERROR: "POST_TO_CLIENTS_ERROR",
  UPDATE_ROOM_ERROR: "UPDATE_ROOM_ERROR",
  UPDATE_CLIENT_ERROR: "UPDATE_CLIENT_ERROR",
};

export const handler = async (event, context) => {
  console.log("Receiving event", event);

  const {
    requestContext: { connectionId },
    body,
  } = event;
  const { roomId } = JSON.parse(body);
  const [response, err] = await getRoom(roomId);

  if (err != null) {
    console.error(`Getting room "${roomId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.GET_ROOM_ERROR,
        error: err,
      }),
    };
  }

  if (response == null || response.Item == null) {
    console.error(`Could not find room "${roomId}".`);
    return {
      statusCode: 404,
      body: JSON.stringify({
        error_type: ERROR_TYPES.ROOM_NOT_FOUND_ERROR,
      }),
    };
  }

  console.log(`Getting room "${roomId}" succeeded.`, response);

  if (response.Item.clients != null) {
    try {
      await postToClients(
        `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
        response.Item.clients.SS,
        roomId,
        JSON.stringify({ type: "client_joined", clientId: connectionId })
      );
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error_type: ERROR_TYPES.POST_TO_CLIENTS_ERROR,
          error: err,
        }),
      };
    }
  }

  try {
    await updateRoom(roomId, connectionId);
  } catch (err) {
    console.error(`Updating room "${roomId}" failed.`, err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.UPDATE_ROOM_ERROR,
        error: err,
      }),
    };
  }

  console.log(`Updating room "${roomId}" succeeded.`);

  try {
    await updateClient(connectionId, roomId);
  } catch (err) {
    console.error(
      `Updating clientId "${connectionId}" to "${roomId}" map failed.`,
      err
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.UPDATE_CLIENT_ERROR,
        error: err,
      }),
    };
  }

  console.log(
    `Updating clientId "${connectionId}" to "${roomId}" map succeeded.`
  );

  return {
    statusCode: 200,
  };
};
