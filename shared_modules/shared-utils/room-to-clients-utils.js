const RoomToClientsUtils = {
  /**
   * @param {*} dynamoDbClient
   * @param {ID} roomId
   * @param {Array<ID>} clients
   * @returns {Attributes: {clients: {SS: Array<ID>}}}
   */
  async addClients(dynamoDbClient, roomId, clients) {
    const response = await dynamoDbClient.send(
      new UpdateItemCommand({
        TableName: process.env.ROOMS_TABLE_NAME,
        Key: {
          roomId: { S: roomId },
        },
        // By default, UpdateItem will perform create the record if it doesn't
        // ready exist. By adding the ConditionExpression, we prevent creating new
        // record if roomId cannot be found.
        ConditionExpression: "attribute_exists(roomId)",
        UpdateExpression: "ADD clients :vals",
        ExpressionAttributeValues: {
          ":vals": { SS: clients },
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return {
      roomId,
      clients,
    };
  },
};

export default RoomToClientsUtils;
