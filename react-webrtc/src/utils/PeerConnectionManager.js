import {
  concatWith,
  ReplaySubject,
  Subject,
  fromEvent,
  BehaviorSubject,
} from "rxjs";

const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

function log(...args) {
  console.log(
    "%cPeerConnectionManager",
    "background: blue; color: white",
    ...args
  );
}

function logError(...args) {
  console.error(
    "%cPeerConnectionManager",
    "background: blue; color: white",
    ...args
  );
}

export default class PeerConnectionManager extends EventTarget {
  isStopped = false;
  subscriptions = [];
  remoteIceCandidatesSubject = new ReplaySubject();
  remoteDescriptionSetSubject = new Subject();
  // offerSubject = new Subject();
  // answerSubject = new Subject();
  // tracksSubject = new Subject();

  constructor(remoteClientId) {
    super();
    this.remoteClientId = remoteClientId;
    this.log(`PeerConnectionManager()`);
  }

  log(...args) {
    log(`${this.remoteClientId}`, ...args);
  }

  destroy() {
    this.isStopped = true;

    this.pc?.close();
    this.pc = null;

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  createConnection() {
    this.log("Creating connection.");

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
            this.dispatchEvent(new Event("failed"));
            break;
          default:
            break;
        }
      }),
      fromEvent(this.pc, "track").subscribe((event) => {
        this.log(`ontrack: ${event.track.kind}, ${event.track.id}`);
        this.dispatchEvent(new CustomEvent("track", { detail: event.track }));
      }),
      fromEvent(this.pc, "icecandidate").subscribe((event) => {
        if (event.candidate == null) {
          this.log(`No more ICE candidates.`);
        } else {
          this.log("onicecandidate:", event.candidate);
          this.dispatchEvent(
            new CustomEvent("icecandidate", { detail: event.candidate })
          );
        }
      }),
      this.remoteDescriptionSetSubject
        .pipe(concatWith(this.remoteIceCandidatesSubject))
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

  async setOfferAndCreateAnswer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSetSubject.complete();
    if (this.isStopped) {
      return null;
    }
    const answer = await this.pc.createAnswer();
    if (this.isStopped) {
      return null;
    }
    await this.pc.setLocalDescription(answer);
    if (this.isStopped) {
      return null;
    }
    return answer;
  }

  async setAnswer(answer) {
    if (this.pc.currentRemoteDescription != null) {
      return;
    }
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
