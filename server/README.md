```
tsc
```

```
$ zip -r chatroom-join-room-1.0.0.zip index.js package.json node_modules

$ aws lambda update-function-code --function-name <name> --zip-file fileb://./chatroom-join-room-1.0.0.zip

$ wscat -c wss://<domain>/<stage>
```

```
{"action": "join_room", "roomId": "<id>"}
```
