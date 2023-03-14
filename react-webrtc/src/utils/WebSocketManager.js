import endpoints from "../api_endpoints.json";

export default class WebSocketManager {
  isStopped = false;

  constructor(eventHandlers) {
    this.eventHandlers = eventHandlers;
  }

  connect() {
    this.webSocket = new WebSocket(endpoints.websocket_endpoint_url);

    this.webSocket.addEventListener("open", (event) => {
      if (this.isStopped) {
        return;
      }

      console.log("WebSocket open.");

      this.eventHandlers["open"]();
    });

    this.webSocket.addEventListener("message", (event) => {
      if (this.isStopped) {
        return;
      }

      console.log("WebSocket new message.", event.data);

      if (event.data) {
        try {
          this.eventHandlers["message"](JSON.parse(event.data));
        } catch (err) {
          console.error(
            "JSON parse error when parsing WebSocket message.",
            err
          );
        }
      }
    });

    this.webSocket.addEventListener("error", (event) => {
      console.error("WebSocket error."); // There is no error detail.
    });

    this.webSocket.addEventListener("close", (event) => {
      // More detail in https://www.rfc-editor.org/rfc/rfc6455#section-11.7
      console.log("WebSocket closed.", event.code);
      this.eventHandlers["close"]();
    });
  }

  close() {
    this.isStopped = true;
    this.webSocket.close();
  }

  send(data) {
    this.webSocket.send(JSON.stringify(data));
  }
}
