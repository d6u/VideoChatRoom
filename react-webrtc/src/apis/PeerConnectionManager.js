import { Subject, Subscription, concatMap, defer, fromEvent } from "rxjs";

import Logger from "../utils/Logger";

const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

export default class PeerConnectionManager {
  // public
  localIceCandidatesSubject = new Subject();
  tracksSubject = new Subject();
  descriptionsSubject = new Subject();

  // private
  subscription = new Subscription();
  remoteIceCandidates = [];
  commandsSubject = new Subject();

  // public

  constructor(isPolite) {
    this.logger = new Logger(`PeerConnectionManager`);
    this.logger.log(`constructor(${this.isPolite})`);
    this.isPolite = isPolite;
  }

  createConnection() {
    this.logger.log("creating connection");

    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.subscription.add(
      fromEvent(this.pc, "signalingstatechange").subscribe(() => {
        this.logger.log(`signaling state change: ${this.pc.signalingState}`);

        if (
          (this.pc.signalingState === "stable" ||
            this.pc.signalingState === "have-remote-offer") &&
          this.remoteIceCandidates.length > 0
        ) {
          this.logger.log(`add cached ice candidates`);

          Promise.all(
            this.remoteIceCandidates.map((iceCandidate) =>
              this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate))
            )
          ).then(() => {
            this.remoteIceCandidates = [];
          });
        }
      })
    );

    this.subscription.add(
      fromEvent(this.pc, "negotiationneeded").subscribe(() => {
        this.logger.log(
          `negotiation needed`,
          `signaling state = ${this.pc.signalingState}`
        );
        this.addCommand({ type: "CreateOffer" });
      })
    );

    this.subscription.add(
      fromEvent(this.pc, "track").subscribe((event) => {
        this.logger.debug(`on track:`, event.streams, event.track);
        this.tracksSubject.next(event);
      })
    );

    this.subscription.add(
      fromEvent(this.pc, "icecandidate").subscribe((event) => {
        if (event.candidate != null) {
          this.logger.debug("new local icecandidate");
          this.localIceCandidatesSubject.next(event.candidate);
        }
      })
    );

    this.subscription.add(
      this.commandsSubject
        .pipe(concatMap(this.createCommandHandlerObservable))
        .subscribe()
    );
  }

  destroy() {
    this.logger.log(`destroy()`);
    this.subscription?.unsubscribe();
    this.pc?.close();
    this.pc = null;
  }

  handleRemoteDescription(description) {
    this.logger.log(
      `received remote description:`,
      `type = ${description.type}`,
      `is polite = ${this.isPolite}`,
      `signaling state = ${this.pc.signalingState}`
    );

    if (description.type === "offer" && this.pc.signalingState !== "stable") {
      if (!this.isPolite) {
        return;
      }

      this.logger.log(
        "setting remote description and rollback local description"
      );

      this.addCommand({
        type: "SetRemoteDescriptionAndCreateAnswer",
        description,
      });
    } else {
      this.logger.log(
        "setting remote description without rollback local description"
      );

      if (description.type === "offer") {
        this.addCommand({
          type: "SetRemoteDescriptionAndCreateAnswer",
          description,
        });
      } else {
        this.addCommand({
          type: "SetRemoteDescription",
          description,
        });
      }
    }
  }

  addIceCandidate(candidate) {
    this.addCommand({ type: "AddIceCandidate", candidate });
  }

  addTrack(track, stream) {
    this.logger.log(`adding local track`);
    this.pc.addTrack(track, stream);
  }

  // private

  addCommand(command) {
    this.logger.log(`*** adding command: ${command.type}`);
    this.commandsSubject.next(command);
  }

  createCommandHandlerObservable = (command) => {
    return defer(async () => {
      this.logger.log(`>>> executing command: ${command.type}`, command);

      switch (command.type) {
        case "CreateOffer":
          const offer = await this.createOffer();
          this.descriptionsSubject.next(offer);
          break;
        case "CreateAnswer": {
          const answer = await this.createAnswer();
          this.descriptionsSubject.next(answer);
          break;
        }
        case "SetRemoteDescription":
          await this.setRemoteDescription(command.description);
          break;
        case "SetRemoteDescriptionAndCreateAnswer": {
          await this.setRemoteDescription(command.description);
          const answer = await this.createAnswer();
          this.descriptionsSubject.next(answer);
          break;
        }
        case "AddIceCandidate":
          await this.addIceCandidateInternal(command.candidate);
          break;
        default:
          break;
      }

      this.logger.log(`<<< finish executing command: ${command.type}`, command);
    });
  };

  async createOffer() {
    try {
      this.logger.log(`creating offer`);
      const offer = await this.pc.createOffer();
      this.logger.log(`setting offer as local description`);
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      this.logger.error(`creating offer error`, error);
    }
  }

  async createAnswer() {
    try {
      this.logger.log(`creating answer`);
      const answer = await this.pc.createAnswer();
      this.logger.log(`setting answer as local description`);
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      this.logger.error(`create answer error`, error);
    }
  }

  async setRemoteDescription(description) {
    if (description.type === "answer" && this.pc.signalingState === "stable") {
      this.logger.warn(
        `ignoring set remote description for answer, because signaling is in stable state`
      );
      return;
    }

    this.logger.log("setting remote description", `type = ${description.type}`);

    try {
      await this.pc.setRemoteDescription(
        new RTCSessionDescription(description)
      );
    } catch (error) {
      this.logger.error(
        `setting remote description error`,
        `type = ${description.type}`,
        error
      );
    }
  }

  async addIceCandidateInternal(iceCandidate) {
    if (
      this.pc.signalingState !== "stable" &&
      this.pc.signalingState !== "have-remote-offer"
    ) {
      this.logger.warn(
        `caching ice candidate, because signaling state is not in stable or have-remote-offer state, i.e. remote description is null`
      );
      this.remoteIceCandidates.push(iceCandidate);
      return;
    }

    this.logger.log(`adding ice candidate`);

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
    } catch (error) {
      this.logger.error(`adding ice candidate error`, error);
    }
  }
}
