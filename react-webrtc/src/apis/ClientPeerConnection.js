import { Subject, Subscription, tap, timer } from "rxjs";

import Logger from "../utils/Logger";
import { sort } from "../utils/operators";
import PeerConnectionManager from "./PeerConnectionManager";

export default class ClientPeerConnection {
  subscription = new Subscription();

  constructor(clientId) {
    this.clientId = clientId;
    this.logger = new Logger(`ClientPeerConnection(${clientId})`);
    this.logger.log(`constructor()`);
  }

  createConnectionAndEventsObservable({
    remoteMessagesObservable,
    localMediaStreamObservable,
    sendMessage,
  }) {
    this.logger.log(`initializeConnection()`);

    this.remoteMessagesObservable = remoteMessagesObservable;
    this.localMediaStreamObservable = localMediaStreamObservable;
    this.sendMessage = sendMessage;

    this.eventsSubject = new Subject();

    this.hasKnownPeerConnectionRole = false;
    this.isPolite = false;
    this.seq = 0;

    this.leaderSelectionValue = Math.floor(
      Math.random() * (Math.pow(2, 31) - 1)
    );

    this.pcm = new PeerConnectionManager();

    this.subscription.add(
      timer(200).subscribe(() => {
        this.send({
          type: "SelectingLeader",
          randomValue: this.leaderSelectionValue,
        });
      })
    );

    this.subscription.add(
      remoteMessagesObservable
        .pipe(
          sort({ initialSeq: -1, seqSelector: (message) => message.seq }),
          tap((message) => {
            this.logger.log(`[${message.seq}] <== [${message.type}]:`, message);
          })
        )
        .subscribe(this.handler)
    );

    return this.eventsSubject;
  }

  send(message) {
    const messageWithSeq = {
      ...message,
      seq: this.seq++,
    };
    this.logger.log(
      `==> [${messageWithSeq.seq}] [${messageWithSeq.type}]:`,
      messageWithSeq
    );
    this.sendMessage({
      action: "DirectMessage",
      toClientId: this.clientId,
      message: messageWithSeq,
    });
  }

  handler = ({ type, randomValue, description, candidate }) => {
    if (type === "SelectingLeader" || type === "ConfirmingLeader") {
      this.handleSelectingLeaderAndConfirmingLeader({ randomValue });
    }

    if (type === "ConfirmingLeader") {
      this.handleConfirmingLeader();
    }

    if (type === "Offer" || type === "Answer") {
      this.handleOfferOrAnswer({ type, description });
    }

    if (type === "IceCandidate") {
      this.pcm.addCommand({ type: "AddIceCandidate", candidate });
    }
  };

  handleSelectingLeaderAndConfirmingLeader({ randomValue }) {
    if (!this.hasKnownPeerConnectionRole) {
      this.hasKnownPeerConnectionRole = true;

      this.isPolite = this.leaderSelectionValue < randomValue;

      this.pcm.createConnection();

      this.subscription.add(
        this.pcm.tracksSubject.subscribe((event) => {
          this.logger.debug("remote stream avaiable", event.streams[0]);
          this.logger.debug("remote track avaiable", event.track);

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
        this.pcm.offersSubject.subscribe((description) => {
          this.send({ type: "Offer", description });
        })
      );

      this.subscription.add(
        this.pcm.answersSubject.subscribe((description) => {
          this.send({ type: "Answer", description });
        })
      );

      this.subscription.add(
        this.pcm.localIceCandidatesSubject.subscribe((candidate) => {
          this.send({ type: "IceCandidate", candidate });
        })
      );

      this.subscription.add(
        this.pcm.negotiationNeededSubject.subscribe(() => {
          this.pcm.addCommand({
            type: "CreateOffer",
          });
        })
      );

      this.send({
        type: "ConfirmingLeader",
        randomValue: this.leaderSelectionValue,
      });
    }
  }

  handleConfirmingLeader() {
    this.subscription.add(
      this.localMediaStreamObservable.subscribe((mediaStream) => {
        this.logger.debug("local MediaStream updated", mediaStream);
        if (mediaStream != null) {
          mediaStream.getTracks().forEach((track) => {
            this.logger.debug("local track", track);
            this.pcm.addTrack(track, mediaStream);
          });
        }
      })
    );
  }

  handleOfferOrAnswer({ type, description }) {
    this.logger.log(
      `received remote description:`,
      `type = ${type}`,
      `is polite = ${this.isPolite}`,
      `signaling state = ${this.pcm.getSignalingState()}`
    );

    if (type === "Offer" && this.pcm.getSignalingState() !== "stable") {
      if (!this.isPolite) {
        return;
      }

      this.logger.log(
        "setting remote description and rollback local description"
      );

      this.pcm.addCommand({
        type: "SetRemoteDescriptionAndCreateAnswer",
        description,
      });
    } else {
      this.logger.log(
        "setting remote description without rollback local description"
      );

      if (type === "Offer") {
        this.pcm.addCommand({
          type: "SetRemoteDescriptionAndCreateAnswer",
          description,
        });
      } else {
        this.pcm.addCommand({
          type: "SetRemoteDescription",
          description,
        });
      }
    }
  }

  destroy() {
    this.logger.log(`destroy()`);
    this.subscription.unsubscribe();
    this.pcm?.destroy();
  }
}
