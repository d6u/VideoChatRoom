import { Subject, Subscription, concat, tap, timer } from "rxjs";

import Logger from "../utils/Logger";
import { sort } from "../utils/operators";
import PeerConnectionManager from "./PeerConnectionManager";

function createRandomValue() {
  return Math.floor(Math.random() * (Math.pow(2, 31) - 1));
}

export default class ClientPeerConnection {
  // public
  eventsSubject = new Subject();

  // private
  subscription = new Subscription();
  hasReceivedFirstLeaderSelectionMessage = false;
  seq = 0;

  // public

  constructor(clientId) {
    this.clientId = clientId;
    this.logger = new Logger(`ClientPeerConnection(${clientId})`);
    this.logger.log(`constructor()`);
  }

  startConnectionProcess({
    leaderSelectionMessagesObservable,
    signalingRemoteMessageObservable,
    localMediaStreamObservable,
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
        randomValue: this.leaderSelectionValue,
      });
    });

    this.subscription.add(
      concat(
        leaderSelectionMessagesObservable,
        signalingRemoteMessageObservable.pipe(
          sort({ initialSeq: -1, seqSelector: (message) => message.seq })
        )
      )
        .pipe(
          tap((message) => {
            this.logger.log(
              `[${message.seq ?? "X"}] <== [${message.type}]:`,
              message
            );
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

  // private

  send(rawMessage) {
    const message = {
      ...rawMessage,
    };

    if (
      message.type !== "SelectingLeader" &&
      message.type !== "ConfirmingLeader"
    ) {
      message.seq = this.seq++;
    }

    this.logger.log(`==> [${message.seq ?? "X"}] [${message.type}]:`, message);
    this.eventsSubject.next({
      type: "SendMessageToRemote",
      message: {
        action: "DirectMessage",
        toClientId: this.clientId,
        message,
      },
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
      this.pcm.handleRemoteDescription(description);
    }

    if (type === "IceCandidate") {
      this.pcm.addIceCandidate(candidate);
    }
  };

  handleSelectingLeaderAndConfirmingLeader({ randomValue }) {
    if (this.hasReceivedFirstLeaderSelectionMessage) {
      return;
    }

    this.hasReceivedFirstLeaderSelectionMessage = true;

    const isPolite = this.leaderSelectionValue < randomValue;

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
          type: description.type === "offer" ? "Offer" : "Answer",
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
      randomValue: this.leaderSelectionValue,
    });
  }

  handleConfirmingLeader() {
    this.subscription.add(
      this.localMediaStreamObservable.subscribe((mediaStream) => {
        this.logger.debug("local MediaStream updated", mediaStream);

        if (mediaStream != null) {
          mediaStream.getTracks().forEach((track) => {
            this.logger.debug("local track", track);
            // This would trigger negotiationneeded, thus, start the signaling
            // process.
            this.pcm.addTrack(track, mediaStream);
          });
        }
      })
    );
  }
}
