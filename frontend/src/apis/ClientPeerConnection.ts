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
  DirectMessage,
  LeaderSelectionDirectMessage,
  SignalingDirectMessage,
  WebSocketActionDirectMessage,
} from "shared-models";

import Logger from "../utils/Logger";
import { sort } from "../utils/operators";
import PeerConnectionManager from "./PeerConnectionManager";

type RawDirectMessage =
  | LeaderSelectionDirectMessage
  | Partial<SignalingDirectMessage>;

type ClientPeerConnectionEvents =
  | {
      type: "SendMessageToRemote";
      message: WebSocketActionDirectMessage;
    }
  | {
      type: "RemoteStream";
      stream: MediaStream;
    }
  | {
      type: "RemoteTrack";
      track: MediaStreamTrack;
    };

function isRawSignalingDirectMessage(
  message: RawDirectMessage
): message is Partial<SignalingDirectMessage> {
  return (
    message.type !== "SelectingLeader" && message.type !== "ConfirmingLeader"
  );
}

function isSignalingDirectMessage(
  message: DirectMessage
): message is SignalingDirectMessage {
  return (
    message.type !== "SelectingLeader" && message.type !== "ConfirmingLeader"
  );
}

function createRandomValue() {
  return Math.floor(Math.random() * (Math.pow(2, 31) - 1));
}

export default class ClientPeerConnection {
  eventsSubject = new Subject<ClientPeerConnectionEvents>();

  private subscription = new Subscription();
  private hasReceivedFirstLeaderSelectionMessage = false;
  private seq = 0;
  private clientId: string;
  private logger: Logger;
  private localMediaStreamObservable: Observable<MediaStream | null> | null =
    null;
  private leaderSelectionValue: number | null = null;
  private sendSelectingLeaderMessageSubscription: Subscription | null = null;
  private pcm: PeerConnectionManager | null = null;

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
    this.logger.log(`initializeConnection()`);

    this.localMediaStreamObservable = localMediaStreamObservable;

    // TODO: Although the chance is very low, avoid collisions.
    this.leaderSelectionValue = createRandomValue();

    // Add a small delay so that React dev mode won't throw this off in
    // useEffect.
    this.sendSelectingLeaderMessageSubscription = timer(200).subscribe(() => {
      this.send({
        type: "SelectingLeader",
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
            if (isSignalingDirectMessage(message)) {
              this.logger.log(
                `[${message.seq ?? "X"}] <== [${message.type}]:`,
                message
              );
            } else {
              this.logger.log(`[X] <== [${message.type}]:`, message);
            }
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

  private send(rawMessage: RawDirectMessage) {
    const message = {
      ...rawMessage,
    };

    if (isRawSignalingDirectMessage(message)) {
      message.seq = this.seq++;

      this.logger.log(`==> [${message.seq}] [${message.type}]:`, message);
    } else {
      this.logger.log(`==> [X] [${message.type}]:`, message);
    }

    this.eventsSubject.next({
      type: "SendMessageToRemote",
      message: {
        action: "DirectMessage",
        toClientId: this.clientId,
        message: message as DirectMessage,
      },
    });
  }

  private handler = (message: DirectMessage) => {
    if (
      message.type === "SelectingLeader" ||
      message.type === "ConfirmingLeader"
    ) {
      this.handleSelectingLeaderAndConfirmingLeader({
        randomValue: message.randomValue,
      });
    }

    if (message.type === "ConfirmingLeader") {
      this.handleConfirmingLeader();
    }

    if (message.type === "Description") {
      this.pcm!.handleRemoteDescription(message.description);
    }

    if (message.type === "IceCandidate") {
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
            type: "RemoteStream",
            stream: event.streams[0],
          });
        } else {
          this.eventsSubject.next({
            type: "RemoteTrack",
            track: event.track,
          });
        }
      })
    );

    this.subscription.add(
      this.pcm.descriptionsSubject.subscribe((description) => {
        this.send({
          type: "Description",
          description,
        });
      })
    );

    this.subscription.add(
      this.pcm.localIceCandidatesSubject.subscribe((candidate) => {
        this.send({ type: "IceCandidate", candidate });
      })
    );

    this.pcm.createConnection();

    // Stop sending SelectingLeader message,
    // since we are send ConfirmingLeader message.
    this.sendSelectingLeaderMessageSubscription?.unsubscribe();

    this.send({
      type: "ConfirmingLeader",
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
