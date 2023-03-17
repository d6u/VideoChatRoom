import { PutItemCommand } from "@aws-sdk/client-dynamodb";

const RoomSnapshotsUtils = {
  async createRoomSnapshot(dynamoDbClient, roomId) {
    await dynamoDbClient.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME_ROOM_SNAPSHOTS,
        Item: {
          RoomId: { S: roomId },
          // Number type must be sent as string.
          Seq: { N: "0" },
          // Cannot specify clientIds, because string set cannot be empty.
        },
      })
    );
  },
};

export default RoomSnapshotsUtils;
