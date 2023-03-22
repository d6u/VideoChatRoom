import { Subject, fromEvent } from "rxjs";

const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default class PeerConnectionManager extends EventTarget {
  isStopped = false;
  subscriptions = [];
  // remoteIceCandidatesSubject = new ReplaySubject();
  // remoteDescriptionSetSubject = new Subject();
  localIceCandidatesSubject = new Subject();
  answerSubject = new Subject();
  tracksSubject = new Subject();
  negotiationNeededSubject = new Subject();

  constructor(remoteClientId) {
    super();
    this.log(`constructor()`);
    this.remoteClientId = remoteClientId;
  }

  log(...args) {
    console.log("PeerConnectionManager", ...args);
  }

  logError(...args) {
    console.error("PeerConnectionManager", ...args);
  }

  destroy() {
    this.log(`destroy()`);

    this.isStopped = true;

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.pc?.close();
    this.pc = null;
  }

  createConnection() {
    this.log("creating peer connection.");

    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.subscriptions.push(
      fromEvent(this.pc, "signalingstatechange").subscribe(() => {
        this.log(`signalingstatechange: ${this.pc.signalingState}`);
      }),
      fromEvent(this.pc, "icegatheringstatechange").subscribe(() => {
        this.log(`onicegatheringstatechange: ${this.pc.iceGatheringState}`);
      }),
      fromEvent(this.pc, "iceconnectionstatechange").subscribe(() => {
        this.log(`oniceconnectionstatechange: ${this.pc.iceConnectionState}`);
      }),
      fromEvent(this.pc, "connectionstatechange").subscribe(() => {
        this.log(`onconnectionstatechange: ${this.pc.connectionState}`);
        switch (this.pc.connectionState) {
          case "failed":
            break;
          default:
            break;
        }
      }),
      fromEvent(this.pc, "negotiationneeded").subscribe(() => {
        this.log(
          `negotiationneeded: signalingState = ${this.pc.signalingState}`
        );
        this.negotiationNeededSubject.next(null);
      }),
      fromEvent(this.pc, "track").subscribe((event) => {
        this.log(`ontrack:`, event.streams, event.track);
        this.tracksSubject.next(event);
      }),
      fromEvent(this.pc, "icecandidate").subscribe((event) => {
        if (event.candidate == null) {
          this.log(`no more ICE candidates`);
          this.localIceCandidatesSubject.complete();
        } else {
          this.log("onicecandidate:", event.candidate);
          this.localIceCandidatesSubject.next(event.candidate);
        }
      })
      // this.remoteIceCandidatesSubject
      //   .pipe(tap(() => this.log("receive remote ice candidate")))
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
