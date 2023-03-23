import { Subject, fromEvent, BehaviorSubject } from "rxjs";
import Logger from "./Logger";

const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default class PeerConnectionManager {
  isStopped = false;
  subscriptions = [];
  // remoteIceCandidatesSubject = new ReplaySubject();
  // remoteDescriptionSetSubject = new Subject();
  localIceCandidatesSubject = new Subject();
  answerSubject = new Subject();
  tracksSubject = new Subject();
  negotiationNeededSubject = new Subject();

  constructor(remoteClientId) {
    this.logger = new Logger("PeerConnectionManager");
    this.logger.log(`constructor()`);
    this.remoteClientId = remoteClientId;
  }

  destroy() {
    this.logger.log(`destroy()`);

    this.isStopped = true;

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.pc?.close();
    this.pc = null;
  }

  createConnection() {
    this.logger.log("creating peer connection.");

    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.logger.log(`signalingstatechange: ${this.pc.signalingState}`);

    this.signalingStateSubject = new BehaviorSubject(this.pc.signalingState);

    this.subscriptions.push(
      fromEvent(this.pc, "signalingstatechange").subscribe(() => {
        this.logger.log(`signalingstatechange: ${this.pc.signalingState}`);
        this.signalingStateSubject.next(this.pc.signalingState);
      }),
      fromEvent(this.pc, "icegatheringstatechange").subscribe(() => {
        this.logger.debug(
          `onicegatheringstatechange: ${this.pc.iceGatheringState}`
        );
      }),
      fromEvent(this.pc, "iceconnectionstatechange").subscribe(() => {
        this.logger.debug(
          `oniceconnectionstatechange: ${this.pc.iceConnectionState}`
        );
      }),
      fromEvent(this.pc, "connectionstatechange").subscribe(() => {
        this.logger.debug(
          `onconnectionstatechange: ${this.pc.connectionState}`
        );
      }),
      fromEvent(this.pc, "negotiationneeded").subscribe(() => {
        this.logger.log(
          `negotiationneeded: signalingState = ${this.pc.signalingState}`
        );
        this.negotiationNeededSubject.next(null);
      }),
      fromEvent(this.pc, "track").subscribe((event) => {
        this.logger.log(`ontrack:`, event.streams, event.track);
        this.tracksSubject.next(event);
      }),
      fromEvent(this.pc, "icecandidate").subscribe((event) => {
        if (event.candidate == null) {
          this.logger.log(`no more ICE candidates`);
          this.localIceCandidatesSubject.complete();
        } else {
          this.logger.log("new local icecandidate");
          this.localIceCandidatesSubject.next(event.candidate);
        }
      })
      // this.remoteIceCandidatesSubject
      //   .pipe(tap(() => this.logger.log("receive remote ice candidate")))
      //   .subscribe((iceCandidate) => {})
    );
  }

  getSignalingState() {
    return this.pc.signalingState;
  }

  getPc() {
    return this.pc;
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    if (this.isStopped) {
      return null;
    }
    await this.pc.setLocalDescription(offer);
    if (this.isStopped) {
      return null;
    }
    return offer;
  }

  async createAnswer() {
    const answer = await this.pc.createAnswer();
    if (this.isStopped) {
      return;
    }
    await this.pc.setLocalDescription(answer);
    if (this.isStopped) {
      return;
    }
    return answer;
  }

  async setOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    if (this.isStopped) {
      return;
    }
    // this.remoteDescriptionSetSubject.complete();
    // this.answerSubject.next(answer);
    // this.answerSubject.complete();
  }

  async setAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    // this.remoteDescriptionSetSubject.complete();
  }

  async addIceCandidate(iceCandidate) {
    await this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
    // this.remoteIceCandidatesSubject.next(iceCandidate);
  }

  addTrack(track, stream) {
    this.pc.addTrack(track, stream);
  }
}
