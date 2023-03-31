import { Observable, Subject, Subscription, tap } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";

import endpoints from "../api_endpoints.json";
import { WebSocketMessage } from "../models/webSocketMessages";
import Logger from "../utils/Logger";

class WebSocketManager {
  // public
  openObserver = new Subject<0>();
  closeObserver = new Subject<0>();
  messagesSubject = new Subject<WebSocketMessage>();

  private logger: Logger;
  private webSocketSubject: WebSocketSubject<any>;
  private webSocketMessagesObservable: Observable<WebSocketMessage>;
  private subscription: Subscription | null = null;

  // public methods

  constructor() {
    this.logger = new Logger("WebSocketManager");

    this.webSocketSubject = webSocket({
      url: endpoints.websocket_endpoint_url,
      openObserver: {
        next: (data) => {
          this.logger.debug("^^^ connection open");
          this.openObserver.next(0);
        },
      },
      closeObserver: {
        next: (event) => {
          // More detail in https://www.rfc-editor.org/rfc/rfc6455#section-11.7
          this.logger.debug("||| connection close", event.code);
          this.closeObserver.next(0);
        },
      },
    });

    this.webSocketMessagesObservable = this.webSocketSubject.pipe(
      tap({
        next: (data) => {
          this.logger.debug(`<== [type: ${data.type}]`, data);
        },
        error: (error) => {
          // There is no error detail for WebSocket errors.
          this.logger.error("*** error", error);
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

  send(data: { action: string; [key: string]: any }) {
    this.logger.debug(`==> [action: ${data.action}]`, data);
    this.webSocketSubject.next(data);
  }
}

const webSocketManager = new WebSocketManager();

export default webSocketManager;
