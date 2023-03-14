const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default class PeerConnectionManager {
  isDestroyed = false;
  callbakcs = {};

  constructor(targetClientKey, callbakcs) {
    this.targetClientKey = targetClientKey;
    this.callbakcs = callbakcs;
  }

  createConnection() {
    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.pc.onsignalingstatechange = (event) => {
      if (this.isDestroyed) {
        return null;
      }
      console.debug(
        `Target client key: ${this.targetClientKey} | onsignalingstatechange: ${this.pc.signalingState}`
      );
    };

    this.pc.onconnectionstatechange = (event) => {
      if (this.isDestroyed) {
        return null;
      }
      console.debug(
        `Target client key: ${this.targetClientKey} | onconnectionstatechange ${this.pc.connectionState}`
      );
      switch (this.pc.connectionState) {
        case "failed": {
          for (const listener of this.onPeerConnectionEndListeners) {
            listener();
          }
          break;
        }
        default: {
          break;
        }
      }
    };

    this.pc.onicegatheringstatechange = (event) => {
      if (this.isDestroyed) {
        return null;
      }
      console.debug(
        `Target client key: ${this.targetClientKey} | onicegatheringstatechange ${this.pc.iceGatheringState}`
      );
    };

    this.pc.oniceconnectionstatechange = (event) => {
      if (this.isDestroyed) {
        return null;
      }
      console.debug(
        `Target client key: ${this.targetClientKey} | oniceconnectionstatechange ${this.pc.iceConnectionState}`
      );
    };

    this.pc.ontrack = (event) => {
      if (this.isDestroyed) {
        return null;
      }
      console.debug(
        `Target client key: ${this.targetClientKey} | ontrack: ${event.track.kind}, ${event.track.id}`
      );
      this.callbakcs["onTrack"](event.track);
    };

    this.pc.onicecandidate = (event) => {
      if (this.isDestroyed) {
        return null;
      }
      if (!event.candidate) {
        console.debug(
          `Target client key: ${this.targetClientKey} | No more ICE candidate.`
        );
        return;
      }
      console.debug(
        `Target client key: ${this.targetClientKey} | onicecandidate.`
      );
      this.callbakcs["onIceCandidate"](event.candidate);
    };
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    if (this.isDestroyed) {
      return null;
    }
    await this.pc.setLocalDescription(offer);
    if (this.isDestroyed) {
      return null;
    }
    return offer;
  }

  async setOfferAndCreateAnswer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    if (this.isDestroyed) {
      return null;
    }
    const answer = await this.pc.createAnswer();
    if (this.isDestroyed) {
      return null;
    }
    await this.pc.setLocalDescription(answer);
    if (this.isDestroyed) {
      return null;
    }
    return answer;
  }

  async setAnswer(answer) {
    if (this.pc.currentRemoteDescription != null) {
      return;
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(iceCandidate) {
    await this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
  }

  addTrack(track, stream) {
    this.pc.addTrack(track, stream);
  }

  destroy() {
    console.debug(
      `Target client key: ${this.targetClientKey} | Destroying PeerConnectionManager.`
    );

    this.isDestroyed = true;

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
