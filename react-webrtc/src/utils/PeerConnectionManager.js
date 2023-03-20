import { concatWith, ReplaySubject, Subject, fromEvent, tap } from "rxjs";

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
  remoteIceCandidatesSubject = new ReplaySubject();
  remoteDescriptionSetSubject = new Subject();
  localIceCandidatesSubject = new Subject();
  answerSubject = new Subject();
  tracksSubject = new Subject();

  constructor(remoteClientId) {
    super();
    this.log(`constructor()`);
    this.remoteClientId = remoteClientId;
  }

  log(...args) {
    console.log(
      "%cPeerConnectionManager",
      "background: blue; color: white",
      ...args
    );
  }

  logError(...args) {
    console.error(
      "%cPeerConnectionManager",
      "background: blue; color: white",
      ...args
    );
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
      fromEvent(this.pc, "track").subscribe((event) => {
        this.log(`ontrack: ${event.track.kind}, ${event.track.id}`);
        this.tracksSubject.next(event.track);
      }),
      fromEvent(this.pc, "icecandidate").subscribe((event) => {
        if (event.candidate == null) {
          this.log(`no more ICE candidates`);
          this.localIceCandidatesSubject.complete();
        } else {
          this.log("onicecandidate:", event.candidate);
          this.localIceCandidatesSubject.next(event.candidate);
        }
      }),
      this.remoteDescriptionSetSubject
        .pipe(
          concatWith(this.remoteIceCandidatesSubject),
          tap(() => this.log("receive remote ice candidate"))
        )
        .subscribe((iceCandidate) => {
          this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
        })
    );
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

  async setOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    if (this.isStopped) {
      return;
    }
    this.remoteDescriptionSetSubject.complete();
    const answer = await this.pc.createAnswer();
    if (this.isStopped) {
      return;
    }
    await this.pc.setLocalDescription(answer);
    if (this.isStopped) {
      return;
    }
    this.answerSubject.next(answer);
    this.answerSubject.complete();
  }

  async setAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.remoteDescriptionSetSubject.complete();
  }

  addIceCandidate(iceCandidate) {
    this.remoteIceCandidatesSubject.next(iceCandidate);
  }

  addTrack(track, stream) {
    this.pc.addTrack(track, stream);
  }
}
