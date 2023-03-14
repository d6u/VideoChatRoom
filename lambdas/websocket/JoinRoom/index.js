import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { addClientIdToRoom, postToClients, updateClient } from "./util.js";

const ERROR_TYPES = {
  RoomNotFoundError: "RoomNotFoundError",
  AddClientIdToRoomError: "AddClientIdToRoomError",
  GetRoomError: "GetRoomError",
  PostToClientsError: "PostToClientsError",
  UpdateClientError: "UpdateClientError",
};

function parseEvent(event) {
  const {
    requestContext: { connectionId },
    body,
  } = event;
  const { roomId } = JSON.parse(body);
  return {
    connectionId,
    roomId,
  };
}

export async function handler(event, context) {
  console.log("Receiving event", event);

  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const { connectionId, roomId } = parseEvent(event);

  // ===

  console.log(`Adding client ID ${connectionId} to room "${roomId}".`);
  let addClientIdToRoomResponse = null;
  try {
    addClientIdToRoomResponse = await addClientIdToRoom(roomId, connectionId);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      console.error(`Room "${roomId}" not found.`);
      return {
        statusCode: 404,
        body: JONS.stringify({
          errorType: ERROR_TYPES.RoomNotFoundError,
        }),
      };
    } else {
      console.error(
        `Adding client ID ${connectionId} to room "${roomId}" failed.`,
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          errorType: ERROR_TYPES.AddClientIdToRoomError,
          error,
        }),
      };
    }
  }
  console.log(
    `Adding client ID ${connectionId} to room "${roomId}" succeeded.`
  );

  // ===

  const clients = addClientIdToRoomResponse.Attributes.clients.SS.filter(
    (clientId) => clientId != connectionId
  );
  const apiGatewayManagementApi = new ApiGatewayManagementApi({ endpoint });
  try {
    await apiGatewayManagementApi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: "ClientList", clients }),
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.PostToClientsError,
        error,
      }),
    };
  }

  // ===

  try {
    await updateClient(connectionId, roomId);
  } catch (error) {
    console.error(
      `Updating clientId "${connectionId}" to "${roomId}" map failed.`,
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.UpdateClientError,
        error,
      }),
    };
  }
  console.log(
    `Updating clientId "${connectionId}" to "${roomId}" map succeeded.`
  );

  // ===

  try {
    await postToClients(
      endpoint,
      clients,
      roomId,
      JSON.stringify({ type: "ClientJoin", clientId: connectionId })
    );
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error_type: ERROR_TYPES.PostToClientsError,
        error: err,
      }),
    };
  }

  return {
    statusCode: 200,
  };
}
