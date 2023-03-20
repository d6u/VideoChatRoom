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
