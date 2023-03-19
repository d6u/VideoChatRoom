import { combineLatestWith, Subject } from "rxjs";

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
  iceCandidatesSubject = new Subject();
  remoteDescriptionSetSubject = new Subject();

  constructor(remoteClientId) {
    log(`Creating PeerConnectionManager(${remoteClientId})`);
    super();
    this.remoteClientId = remoteClientId;
  }

  createConnection() {
    log("Creating connection.");

    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.pc.onsignalingstatechange = (event) => {
      if (this.isStopped) {
        return;
      }
      log(
        `${this.remoteClientId} | onsignalingstatechange: ${this.pc.signalingState}`
      );
    };

    this.pc.onconnectionstatechange = (event) => {
      if (this.isStopped) {
        return;
      }
      log(
        `${this.remoteClientId} | onconnectionstatechange ${this.pc.connectionState}`
      );
      switch (this.pc.connectionState) {
        case "failed":
          this.dispatchEvent(new Event("failed"));
          break;
        default:
          break;
      }
    };

    this.pc.onicegatheringstatechange = (event) => {
      if (this.isStopped) {
        return;
      }
      log(
        `${this.remoteClientId} | onicegatheringstatechange ${this.pc.iceGatheringState}`
      );
    };

    this.pc.oniceconnectionstatechange = (event) => {
      if (this.isStopped) {
        return;
      }
      log(
        `${this.remoteClientId} | oniceconnectionstatechange ${this.pc.iceConnectionState}`
      );
    };

    this.pc.ontrack = (event) => {
      if (this.isStopped) {
        return;
      }
      log(
        `${this.remoteClientId} | ontrack: ${event.track.kind}, ${event.track.id}`
      );
      this.dispatchEvent(new CustomEvent("track", { detail: event.track }));
    };

    this.pc.onicecandidate = (event) => {
      if (this.isStopped) {
        return;
      }
      if (!event.candidate) {
        log(`${this.remoteClientId} | No more ICE candidate.`);
        return;
      }
      log(`${this.remoteClientId} | onicecandidate.`);
      this.dispatchEvent(
        new CustomEvent("icecandidate", { detail: event.candidate })
      );
    };

    this.iceCandidatesSubject
      .pipe(combineLatestWith(this.remoteDescriptionSetSubject))
      .subscribe(([iceCandidate]) => {
        this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
      });
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
    this.remoteDescriptionSetSubject.next();
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
    this.remoteDescriptionSetSubject.next();
  }

  addIceCandidate(iceCandidate) {
    this.iceCandidatesSubject.next(iceCandidate);
  }

  addTrack(track, stream) {
    this.pc.addTrack(track, stream);
  }

  destroy() {
    this.isStopped = true;

    if (this.pc != null) {
      this.pc.close();
      this.pc.onsignalingstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc = null;
    }
  }
}
