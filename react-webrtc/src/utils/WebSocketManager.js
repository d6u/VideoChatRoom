import endpoints from "../api_endpoints.json";

export default class WebSocketManager extends EventTarget {
  isStopped = false;

  connect() {
    if (this.isStopped) {
      throw new Error("This instance is already stopped.");
    }

    this.webSocket = new WebSocket(endpoints.websocket_endpoint_url);

    this.webSocket.addEventListener("open", (event) => {
      if (this.isStopped) {
        return;
      }
      console.debug("WebSocket open.");
      this.dispatchEvent(new Event("open"));
    });

    this.webSocket.addEventListener("message", (event) => {
      if (this.isStopped) {
        return;
      }

      console.debug("WebSocket new message:", event.data);

      if (event.data) {
        let data = null;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          console.error("JSON parse error.", err);
        }
        if (data != null) {
          this.dispatchEvent(new CustomEvent("message", { detail: data }));
        }
      }
    });

    this.webSocket.addEventListener("error", (event) => {
      console.error("WebSocket error."); // There is no error detail.
    });

    this.webSocket.addEventListener("close", (event) => {
      // More detail in https://www.rfc-editor.org/rfc/rfc6455#section-11.7
      console.debug("WebSocket closed.", event.code);

      this.dispatchEvent(new Event("close"));
    });
  }

  close() {
    this.isStopped = true;
    if (this.webSocket != null) {
      this.webSocket.close();
    }
  }

  send(data) {
    if (this.isStopped) {
      throw new Error("This instance is already stopped.");
    }
    if (this.webSocket == null) {
      throw new Error("WebSocket is not created yet.");
    }

    console.debug("WebSocket send message: ", JSON.stringify(data));

    this.webSocket.send(JSON.stringify(data));
  }
}
