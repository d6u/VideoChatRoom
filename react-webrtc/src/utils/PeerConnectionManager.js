import {
  Subject,
  fromEvent,
  Subscription,
  mergeMap,
  defer,
  from,
  map,
} from "rxjs";
import Logger from "./Logger";

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
        this.logger.log(`on track:`, event.streams, event.track);
        this.tracksSubject.next(event);
      })
    );

    this.subscription.add(
      fromEvent(this.pc, "icecandidate").subscribe((event) => {
        if (event.candidate != null) {
          this.logger.log("new local icecandidate");
          this.localIceCandidatesSubject.next(event.candidate);
        }
      })
    );
  }

  destroy() {
    this.logger.log(`destroy()`);
    this.subscription?.unsubscribe();
    this.pc?.close();
    this.pc = null;
  }

  createOfferObservable() {
    return defer(() => {
      this.logger.log(`creating offer`);
      return from(this.pc.createOffer());
    }).pipe(
      mergeMap((offer) => {
        this.logger.log(`setting local description for offer`);
        return from(this.setLocalDescription(offer)).pipe(map(() => offer));
      })
    );
  }

  createAnswerObservable() {
    return defer(() => {
      this.logger.log(`creating answer`);
      return from(this.pc.createAnswer());
    }).pipe(
      mergeMap((answer) => {
        this.logger.log(`setting local description for answer`);
        return from(this.setLocalDescription(answer)).pipe(map(() => answer));
      })
    );
  }

  async setLocalDescription(description) {
    try {
      await this.pc.setLocalDescription(new RTCSessionDescription(description));
    } catch (error) {
      this.logger.error(error);
    }
  }

  async setRemoteDescription(description) {
    try {
      await this.pc.setRemoteDescription(
        new RTCSessionDescription(description)
      );
    } catch (error) {
      this.logger.error(error);
    }
  }

  async addIceCandidate(iceCandidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
    } catch (error) {
      this.logger.error(error);
    }
  }

  addTrack(track, stream) {
    this.pc.addTrack(track, stream);
  }

  getSignalingState() {
    return this.pc.signalingState;
  }
}
