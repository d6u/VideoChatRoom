# Lambda

## Endpoints

### Web Pages

- `/`
- `/rooms/:id`

### HTTP Endpoints

- POST `/rooms`
  - Request: None
  - Response: `{"roomId": ID}`

### WebSocket API Routes (Actions)

- `{"action": "join_room", "roomId": ID}`
  - Broadcast:
    - `{"type": "client_joined", "clientId": ID}`
    - `{"type": "client_left", "clientId": ID}`

## Database Schema

```
Room:
{
  roomId: ID,
  clients: Array<ID>,
}
```
