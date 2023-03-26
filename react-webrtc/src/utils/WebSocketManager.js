import { Subject, Subscription, tap } from "rxjs";
import { webSocket } from "rxjs/webSocket";
import Logger from "./Logger";
import endpoints from "../api_endpoints.json";

class WebSocketManager {
  openObserver = new Subject();
  closeObserver = new Subject();
  messagesSubject = new Subject();

  constructor() {
    this.logger = new Logger("WebSocketManager");

    this.webSocketSubject = webSocket({
      url: endpoints.websocket_endpoint_url,
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
    this.subscription?.unsubscribe();
    this.subscription = new Subscription(() => {
      this.logger.log("subscription disposed");
    });
    this.subscription.add(
      this.webSocketMessagesObservable.subscribe(this.messagesSubject)
    );
  }

  disconnect() {
    this.logger.log("disconnect()");
    this.subscription?.unsubscribe();
  }

  send(data) {
    this.logger.debug("sending message:", JSON.stringify(data, null, 4));
    this.webSocketSubject.next(data);
  }
}

const webSocketManager = new WebSocketManager();

export default webSocketManager;
