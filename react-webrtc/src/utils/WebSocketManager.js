import { Subject } from "rxjs";
import { webSocket } from "rxjs/webSocket";
import endpoints from "../api_endpoints.json";

function log(...args) {
  console.debug("%cWebSocketManager", "background: lightgreen", ...args);
}

function logError(...args) {
  console.error("%cWebSocketManager", "background: lightgreen", ...args);
}

export default class WebSocketManager extends EventTarget {
  webSocketSubject = null;
  subscription = null;
  openObserver = new Subject();
  closeObserver = new Subject();
  messageObserver = new Subject();

  connect() {
    this.webSocketSubject = webSocket({
      url: endpoints.websocket_endpoint_url,
      openObserver: {
        next: (data) => {
          log("onopen", data);
          this.openObserver.next();
        },
      },
      closeObserver: {
        next: (event) => {
          // More detail in https://www.rfc-editor.org/rfc/rfc6455#section-11.7
          log("onclose", event.code);
          this.closeObserver.next();
        },
      },
    });

    this.subscription = this.webSocketSubject.subscribe({
      next: (data) => {
        log("onmessage", data);
        this.messageObserver.next(data);
      },
      error(error) {
        // There is no error detail for WebSocket errors.
        logError("onerror", error);
      },
    });
  }

  close() {
    if (this.webSocketSubject != null) {
      this.webSocketSubject.complete();
    }
  }

  send(data) {
    if (this.webSocketSubject == null) {
      throw new Error("WebSocket is not created yet.");
    }

    log("sending message", JSON.stringify(data));

    this.webSocketSubject.next(data);
  }
}
