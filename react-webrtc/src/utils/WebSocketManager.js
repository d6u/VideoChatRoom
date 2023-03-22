import { nanoid } from "nanoid";
import { share, Subject, tap } from "rxjs";
import { webSocket } from "rxjs/webSocket";

import endpoints from "../api_endpoints.json";

export default class WebSocketManager {
  subscription = null;
  openObserver = new Subject();
  closeObserver = new Subject();

  constructor() {
    this.instanceId = nanoid();
    this.log("ctor()");
    this.webSocketSubject = webSocket({
      url: endpoints.websocket_endpoint_url,
      deserializer: (event) => {
        try {
          return JSON.parse(event.data);
        } catch (error) {
          this.logError("JSON parse error.", event.data);
          return {};
        }
      },
      openObserver: {
        next: (data) => {
          this.log("onopen", data);
          this.openObserver.next();
        },
      },
      closeObserver: {
        next: (event) => {
          // More detail in https://www.rfc-editor.org/rfc/rfc6455#section-11.7
          this.log("onclose", event.code);
          this.closeObserver.next();
        },
      },
    });

    this.webSocketObservable = this.webSocketSubject.pipe(
      tap({
        next: (data) => {
          this.log("onmessage", data);
        },
        error: (error) => {
          // There is no error detail for WebSocket errors.
          this.logError("onerror", error);
        },
      }),
      share()
    );
  }

  log(...args) {
    console.debug(`WebSocketManager [${this.instanceId}]`, ...args);
  }

  logError(...args) {
    console.error(`WebSocketManager [${this.instanceId}]`, ...args);
  }

  send(data) {
    this.log("sending message", JSON.stringify(data));
    this.webSocketSubject.next(data);
  }
}
