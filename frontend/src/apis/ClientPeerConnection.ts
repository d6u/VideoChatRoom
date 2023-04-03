import {
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  concat,
  tap,
  timer,
} from "rxjs";
import {
  DescriptionDirectMessage,
  DirectMessage,
  DirectMessageType,
  IceCandidateDirectMessage,
  LeaderSelectionDirectMessage,
  SignalingDirectMessage,
  WebSocketActionDirectMessage,
  isLeaderSelectionMessage,
  isSignalingDirectMessage,
} from "shared-models";

import Logger from "../utils/Logger";
import { sort } from "../utils/operators";
import PeerConnectionManager from "./PeerConnectionManager";

type DirectMessageNoSeq =
  | LeaderSelectionDirectMessage
  | Omit<DescriptionDirectMessage, "seq">
  | Omit<IceCandidateDirectMessage, "seq">;

enum ClientPeerConnectionEventType {
  SendMessageToRemote = "SendMessageToRemote",
  RemoteStream = "RemoteStream",
  RemoteTrack = "RemoteTrack",
}

type ClientPeerConnectionEvent =
  | {
      type: ClientPeerConnectionEventType.SendMessageToRemote;
      message: WebSocketActionDirectMessage;
    }
  | {
      type: ClientPeerConnectionEventType.RemoteStream;
      stream: MediaStream;
    }
  | {
      type: ClientPeerConnectionEventType.RemoteTrack;
      track: MediaStreamTrack;
    };

export default class ClientPeerConnection {
  eventsSubject = new Subject<ClientPeerConnectionEvent>();

  private subscription = new Subscription();
  private hasReceivedFirstLeaderSelectionMessage = false;
  private seq = 0;
  private clientId: string;
  private logger: Logger;
  private localMediaStreamObservable?: Observable<MediaStream | null>;
  private leaderSelectionValue?: number;
  private sendSelectingLeaderMessageSubscription?: Subscription;
  private pcm?: PeerConnectionManager;

  constructor(clientId: string) {
    this.clientId = clientId;
    this.logger = new Logger(`ClientPeerConnection(${clientId})`);
    this.logger.log(`constructor()`);
  }

  startConnectionProcess({
    leaderSelectionMessagesObservable,
    signalingRemoteMessageObservable,
    localMediaStreamObservable,
  }: {
    leaderSelectionMessagesObservable: Observable<LeaderSelectionDirectMessage>;
    signalingRemoteMessageObservable: Observable<SignalingDirectMessage>;
    localMediaStreamObservable: Observable<MediaStream | null>;
  }) {
    this.logger.log(`startConnectionProcess()`);

    this.localMediaStreamObservable = localMediaStreamObservable;

    // TODO: Although the chance is very low, avoid collisions.
    this.leaderSelectionValue = createRandomValue();

    // Add a small delay so that useEffect in React dev mode won't
    // throw this off.
    this.sendSelectingLeaderMessageSubscription = timer(200).subscribe(() => {
      this.send({
        type: DirectMessageType.SelectingLeader,
        randomValue: this.leaderSelectionValue!,
      });
    });

    const signalingRemoteMessageSuject = new ReplaySubject<DirectMessage>();

    this.subscription.add(
      signalingRemoteMessageObservable
        .pipe(
          sort({
            initialSeq: -1,
            seqSelector: (message) => message.seq,
            notifySequenceGap: ({ fromSeq, toSeq, messages }) => {
              this.logger.warn(
                `first message's seq wasn't right after prevSeq ${fromSeq}.`,
                JSON.stringify(messages.toJS(), null, 4)
              );
            },
          })
        )
        .subscribe(signalingRemoteMessageSuject)
    );

    this.subscription.add(
      // Subscribe to a ReplaySubject because concat() will not subscribe to
      // the second observable until the first observable completes.
      concat(leaderSelectionMessagesObservable, signalingRemoteMessageSuject)
        .pipe(
          tap((message) => {
            const seq = isSignalingDirectMessage(message) ? message.seq : "X";
            this.logger.log(`[${seq}] <== [${message.type}]:`, message);
          })
        )
        .subscribe(this.handler)
    );
  }

  destroy() {
    this.logger.log(`destroy()`);
    this.subscription.unsubscribe();
    this.sendSelectingLeaderMessageSubscription?.unsubscribe();
    this.pcm?.destroy();
  }

  private send(rawMessage: DirectMessageNoSeq) {
    const message: DirectMessageNoSeq & { seq?: number } = {
      ...rawMessage,
    };

    if (
      message.type !== DirectMessageType.SelectingLeader &&
      message.type !== DirectMessageType.ConfirmingLeader
    ) {
      message.seq = this.seq++;
    }

    this.logger.log(`==> [${message.seq ?? "X"}] [${message.type}]:`, message);

    this.eventsSubject.next({
      type: ClientPeerConnectionEventType.SendMessageToRemote,
      message: {
        action: "DirectMessage",
        toClientId: this.clientId,
        message: message as DirectMessage,
      },
    });
  }

  private handler = (message: DirectMessage) => {
    if (isLeaderSelectionMessage(message)) {
      this.handleSelectingLeaderAndConfirmingLeader({
        randomValue: message.randomValue,
      });
    }

    if (message.type === DirectMessageType.ConfirmingLeader) {
      this.handleConfirmingLeader();
    }

    if (message.type === DirectMessageType.Description) {
      this.pcm!.handleRemoteDescription(message.description);
    }

    if (message.type === DirectMessageType.IceCandidate) {
      this.pcm!.addIceCandidate(message.candidate);
    }
  };

  private handleSelectingLeaderAndConfirmingLeader({
    randomValue,
  }: {
    randomValue: number;
  }) {
    if (this.hasReceivedFirstLeaderSelectionMessage) {
      return;
    }

    this.hasReceivedFirstLeaderSelectionMessage = true;

    const isPolite = this.leaderSelectionValue! < randomValue;

    this.pcm = new PeerConnectionManager(isPolite);

    this.subscription.add(
      this.pcm.tracksSubject.subscribe((event) => {
        this.logger.debug(
          "remote track avaiable",
          "stream = ",
          event.streams[0],
          "track = ",
          event.track
        );

        if (event.streams != null && event.streams[0] != null) {
          this.eventsSubject.next({
            type: ClientPeerConnectionEventType.RemoteStream,
            stream: event.streams[0],
          });
        } else {
          this.eventsSubject.next({
            type: ClientPeerConnectionEventType.RemoteTrack,
            track: event.track,
          });
        }
      })
    );

    this.subscription.add(
      this.pcm.descriptionsSubject.subscribe((description) => {
        this.send({
          type: DirectMessageType.Description,
          description,
        });
      })
    );

    this.subscription.add(
      this.pcm.localIceCandidatesSubject.subscribe((candidate) => {
        this.send({ type: DirectMessageType.IceCandidate, candidate });
      })
    );

    this.pcm.createConnection();

    // Stop sending SelectingLeader message,
    // since we are send ConfirmingLeader message.
    this.sendSelectingLeaderMessageSubscription?.unsubscribe();

    this.send({
      type: DirectMessageType.ConfirmingLeader,
      randomValue: this.leaderSelectionValue!,
    });
  }

  private handleConfirmingLeader() {
    this.subscription.add(
      this.localMediaStreamObservable!.subscribe((mediaStream) => {
        this.logger.debug("local MediaStream updated", mediaStream);

        if (mediaStream != null) {
          mediaStream.getTracks().forEach((track) => {
            this.logger.debug("local track", track);
            // This would trigger negotiationneeded, thus, start the signaling
            // process.
            this.pcm!.addTrack(track, mediaStream);
          });
        }
      })
    );
  }
}

function createRandomValue() {
  return Math.floor(Math.random() * (Math.pow(2, 31) - 1));
}
