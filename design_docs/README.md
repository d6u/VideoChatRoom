## Data Schema

**Action from client to server:**

```
{
  action: "JoinRoom",
  roomId: <roomId>
}
```

**Action from lambda to SQS:**

```
{
  action: "ClientJoin" | "ClientLeft",
  groupId: <roomId>,
  dedupId: <requestId>,
  roomId: <roomId>,
  clientId: <clientId>
}
```

**Delta:**

```
{
  isDelta: true,
  type: "ClientJoin" | "ClientList",
  seq: Int,
  roomId: <roomId>,
  clientId: <clientId>
}
```

**Non-delta events:**

```
{
  isDelta: false,
  type: "CurrentClientId",
  clientId: <clientId>
}
```

**Snapshot:**

```
{

}
```
