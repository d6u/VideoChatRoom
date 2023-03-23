import { Subject, tap } from "rxjs";
import { webSocket } from "rxjs/webSocket";
import Logger from "./Logger";
import endpoints from "../api_endpoints.json";

class WebSocketManager {
  subscriptions = [];
  openObserver = new Subject();
  closeObserver = new Subject();
  messagesSubject = new Subject();

  constructor() {
    this.logger = new Logger("WebSocketManager");

    this.webSocketSubject = webSocket({
      url: endpoints.websocket_endpoint_url,
      deserializer: (event) => {
        try {
          return JSON.parse(event.data);
        } catch (error) {
          this.logger.error("JSON parse error.", event.data);
          return {};
        }
      },
      openObserver: {
        next: (data) => {
          this.logger.debug("connection open");
          this.openObserver.next();
        },
      },
      closeObserver: {
        next: (event) => {
          // More detail in https://www.rfc-editor.org/rfc/rfc6455#section-11.7
          this.logger.debug("connection close", event.code);
          this.closeObserver.next();
        },
      },
    });

    this.webSocketMessagesObservable = this.webSocketSubject.pipe(
      tap({
        next: (data) => {
          this.logger.debug("message", data);
        },
        error: (error) => {
          // There is no error detail for WebSocket errors.
          this.logger.error("error", error);
        },
      })
    );
  }

  connect() {
    this.logger.log("connect()");
    this.subscriptions.push(
      this.webSocketMessagesObservable.subscribe(this.messagesSubject)
    );
  }

  disconnect() {
    this.logger.log("disconnect()");
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];
  }

  send(data) {
    this.logger.debug("sending message", JSON.stringify(data));
    this.webSocketSubject.next(data);
  }
}

const webSocketManager = new WebSocketManager();

export default webSocketManager;
