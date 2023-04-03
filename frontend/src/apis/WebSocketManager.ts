import {
  Observable,
  Subject,
  Subscription,
  filter,
  map,
  partition,
  share,
  tap,
} from "rxjs";
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import {
  DirectMessage,
  LeaderSelectionDirectMessage,
  SignalingDirectMessage,
  WebSocketAction,
  WebSocketMessage,
  filterForWebSocketMessageDirectMessage,
  isLeaderSelectionMessage,
} from "shared-models";

import endpoints from "../api_endpoints.json";
import Logger from "../utils/Logger";

class WebSocketManager {
  openObserver = new Subject<0>();
  closeObserver = new Subject<0>();
  messagesSubject = new Subject<WebSocketMessage>();

  private logger: Logger;
  // For reasoning of using any, see definition of WebSocketSubject below.
  private webSocketSubject: WebSocketSubject<any>;
  private webSocketMessagesObservable: Observable<WebSocketMessage>;
  private subscription: Subscription | null = null;

  constructor() {
    this.logger = new Logger("WebSocketManager");

    // Cannot provide specific type for WebSocketSubject because the provided
    // type definition force incoming and outgoing message to be the same type.
    this.webSocketSubject = webSocket<any>({
      url: endpoints.WebSocketEndpointUrl,
      openObserver: {
        next: () => {
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
          // There is no error detail return by browser WebSocket API.
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

  send(action: WebSocketAction) {
    this.logger.debug(`==> [action: ${action.action}]`, action);
    this.webSocketSubject.next(action);
  }

  partitionDirectMessagesFromClientId(
    fromClientId: string
  ): [
    Observable<LeaderSelectionDirectMessage>,
    Observable<SignalingDirectMessage>
  ] {
    return partition<DirectMessage>(
      this.messagesSubject.pipe(
        filter(filterForWebSocketMessageDirectMessage(fromClientId)),
        map((message) => message.message),
        share()
      ),
      isLeaderSelectionMessage
    ) as [
      Observable<LeaderSelectionDirectMessage>,
      Observable<SignalingDirectMessage>
    ];
  }
}

const webSocketManager = new WebSocketManager();

export default webSocketManager;
