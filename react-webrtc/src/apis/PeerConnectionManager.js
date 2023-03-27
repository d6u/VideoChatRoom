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
  localIceCandidatesSubject = new Subject();
  tracksSubject = new Subject();
  negotiationNeededSubject = new Subject();
  remoteIceCandidates = [];
  commandsSubject = new Subject();
  offersSubject = new Subject();
  answersSubject = new Subject();

  constructor() {
    this.logger = new Logger("PeerConnectionManager");
    this.logger.log(`constructor()`);
  }

  createConnection() {
    this.logger.log("creating peer connection");

    this.subscription = new Subscription(() => {
      this.logger.log("subscription disposed");
    });

    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.subscription.add(
      fromEvent(this.pc, "signalingstatechange").subscribe(() => {
        this.logger.log(`signaling state change: ${this.pc.signalingState}`);
      })
    );

    this.subscription.add(
      fromEvent(this.pc, "negotiationneeded").subscribe(() => {
        this.logger.log(
          `negotiation needed: signalingState = ${this.pc.signalingState}`
        );
        this.negotiationNeededSubject.next(null);
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
        .pipe(
          concatMap((command) =>
            defer(async () => {
              this.logger.log(
                `>>> executing command: ${command.type}`,
                command
              );

              switch (command.type) {
                case "CreateOffer":
                  const offer = await this.createOffer();
                  this.offersSubject.next(offer);
                  break;
                case "CreateAnswer": {
                  const answer = await this.createAnswer();
                  this.answersSubject.next(answer);
                  break;
                }
                case "SetRemoteDescription":
                  await this.setRemoteDescription(command.description);
                  break;
                case "SetRemoteDescriptionAndCreateAnswer": {
                  await this.setRemoteDescription(command.description);
                  const answer = await this.createAnswer();
                  this.answersSubject.next(answer);
                  break;
                }
                case "AddIceCandidate":
                  await this.addIceCandidate(command.candidate);
                  break;
                default:
                  break;
              }

              this.logger.log(
                `<<< finish executing command: ${command.type}`,
                command
              );
            })
          )
        )
        .subscribe(() => {})
    );
  }

  destroy() {
    this.logger.log(`destroy()`);
    this.subscription?.unsubscribe();
    this.pc?.close();
    this.pc = null;
  }

  addCommand(command) {
    this.logger.log(`*** adding command: ${command.type}`);
    this.commandsSubject.next(command);
  }

  async createOffer() {
    try {
      this.logger.log(`creating offer`);
      const offer = await this.pc.createOffer();
      this.logger.log(`setting local description for offer`);
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      this.logger.error(`setting local description for offer`, error);
    }
  }

  async createAnswer() {
    try {
      this.logger.log(`creating answer`);
      const answer = await this.pc.createAnswer();
      this.logger.log(`setting local description for answer`);
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      this.logger.error(`setting local description for answer`, error);
    }
  }

  async setLocalDescription(description) {
    try {
      this.logger.log(`setting local description`);
      await this.pc.setLocalDescription(new RTCSessionDescription(description));
    } catch (error) {
      this.logger.error(
        `setting local description, type = ${description.type}`,
        error
      );
    }
  }

  async setRemoteDescription(description) {
    if (description.type === "answer") {
      if (this.pc.signalingState === "stable") {
        this.logger.warn(
          `ignoring set remote description for answer, because signaling is in stable state`
        );
        return;
      }
    }

    try {
      this.logger.log(
        `setting remote description`,
        `type = ${description.type}`
      );
      await this.pc.setRemoteDescription(
        new RTCSessionDescription(description)
      );
      this.logger.log(`add cached ice candidates`);
      await Promise.all(
        this.remoteIceCandidates.map((iceCandidate) =>
          this.addIceCandidate(iceCandidate)
        )
      );
      this.remoteIceCandidates = [];
    } catch (error) {
      this.logger.error(`remote description type = ${description.type}`, error);
    }
  }

  async addIceCandidate(iceCandidate) {
    this.logger.log(
      `adding ice candidate`,
      `signaling state = ${this.pc.signalingState}`,
      `remote description =`,
      this.pc.remoteDescription
    );

    if (this.pc.remoteDescription == null) {
      this.logger.log(`remote description is null, caching ice candidate`);
      this.remoteIceCandidates.push(iceCandidate);
      return;
    }

    try {
      this.logger.log(`remote description is not null, adding ice candidate`);
      await this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
    } catch (error) {
      this.logger.error(error);
    }
  }

  addTrack(track, stream) {
    this.logger.log(`adding local track`);
    this.pc.addTrack(track, stream);
  }

  getSignalingState() {
    return this.pc.signalingState;
  }
}