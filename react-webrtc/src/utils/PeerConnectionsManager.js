import { BehaviorSubject } from "rxjs";
import { Record, Set, Map, List } from "immutable";
import PeerConnectionManager from "./PeerConnectionManager";

function log(...args) {
  console.debug("%cPeerConnectionsManager", "background: lightblue", ...args);
}

function logError(...args) {
  console.error("%cPeerConnectionsManager", "background: lightblue", ...args);
}

const Client = Record({
  peerConnectionManager: null,
  localMediaStreamSubsriber: null,
  videoTrackSubject: null,
  audioTrackSubject: null,
  localRandomValue: -1,
  connectionRole: "UNKNOWN",
  peerConnectionRole: "UNKNOWN",
});

export default class PeerConnectionsManager extends EventTarget {
  isStopped = false;
  currentClientId = null;
  clientIds = Set();
  oldClientIds = Set();
  clients = Map();

  constructor(localMediaStreamSubject) {
    super();
    this.localMediaStreamSubject = localMediaStreamSubject;
    this.addEventListener("data", this.handleData);
    this.addEventListener("connectclient", this.handleConnectClient);
  }

  destroy() {
    this.isStopped = true;
    this.removeEventListener("data", this.handleData);
    this.removeEventListener("connectclient", this.handleConnectClient);
  }

  setCurrentClientId(currentClientId) {
    this.currentClientId = currentClientId;
    this.dispatchEvent(new Event("data"));
  }

  setClientIds(clientIds) {
    this.oldClientIds = this.clientIds;
    this.clientIds = Set(clientIds);
    this.dispatchEvent(new Event("data"));
  }

  handleData = () => {
    const joinedClientIds = this.clientIds.subtract(this.oldClientIds);
    const leftClientIds = this.oldClientIds.subtract(this.clientIds);

    log({
      joinedClientIds: joinedClientIds.toJS(),
      leftClientIds: leftClientIds.toJS(),
    });

    // === Clean up old client info ===

    leftClientIds.forEach((clientId) => {
      if (this.clients.getIn([clientId, "peerConnectionManager"]) != null) {
        this.clients.getIn([clientId, "peerConnectionManager"]).destroy();
      }
      if (
        this.clientIds.getIn([clientId, "localMediaStreamSubsriber"]) != null
      ) {
        this.clientIds
          .getIn([clientId, "localMediaStreamSubsriber"])
          .unsubscribe();
      }
      this.clients = this.clients.delete(clientId);
    });

    // === Creating new client info ===

    joinedClientIds.forEach((clientId) => {
      if (!this.clients.has(clientId)) {
        this.clients = this.clients.set(
          clientId,
          Client({
            videoTrackSubject: new BehaviorSubject(null),
            audioTrackSubject: new BehaviorSubject(null),
          })
        );
      }

      const connectionRole =
        this.currentClientId == null
          ? "UNKNOWN"
          : clientId === this.currentClientId
          ? "LOCAL"
          : "REMOTE";

      if (
        connectionRole === "REMOTE" &&
        this.clients.getIn([clientId, "peerConnectionManager"]) == null
      ) {
        const randomValue = Math.floor(Math.random() * (Math.pow(2, 31) - 1));
        this.clients = this.clients.setIn(
          [clientId, "localRandomValue"],
          randomValue
        );

        this.dispatchEvent(
          new CustomEvent("selectleader", { detail: { clientId, randomValue } })
        );
      }

      this.clients = this.clients.setIn(
        [clientId, "connectionRole"],
        connectionRole
      );
    });

    this.dispatchEvent(new CustomEvent("clients", { detail: this.clients }));
  };

  handleConnectClient = (event) => {
    const { fromClientId, messageData } = event.detail;

    switch (messageData.type) {
      case "SelectingLeader": {
        if (!this.clients.has(fromClientId)) {
          return;
        }

        const peerConnectionManager = new PeerConnectionManager(fromClientId);

        peerConnectionManager.addEventListener("icecandidate", (event) => {
          const { detail } = event;
          log("icecandidate", detail);
        });

        peerConnectionManager.addEventListener("track", (event) => {
          const { detail } = event;
          log("track", detail);
          if (detail.kind === "video") {
            this.clients
              .getIn([fromClientId, "videoTrackSubject"])
              .next(detail);
          } else if (detail.kind === "audio") {
            this.clients
              .getIn([fromClientId, "audioTrackSubject"])
              .next(detail);
          }
        });

        peerConnectionManager.createConnection();

        const localMediaStreamSubsriber =
          this.localMediaStreamSubject.subscribe((mediaStream) => {
            mediaStream.getTracks().forEach((track) => {
              peerConnectionManager.addTrack(track, mediaStream);
            });
          });

        this.clients = this.clients
          .setIn([fromClientId, "peerConnectionManager"], peerConnectionManager)
          .setIn(
            [fromClientId, "localMediaStreamSubsriber"],
            localMediaStreamSubsriber
          );

        if (
          this.clients.getIn([fromClientId, "localRandomValue"]) > -1 &&
          this.clients.getIn([fromClientId, "localRandomValue"]) <
            messageData.randomValue
        ) {
          this.clients = this.clients.setIn(
            [fromClientId, "peerConnectionRole"],
            "ANSWER"
          );
        } else {
          this.clients = this.clients.setIn(
            [fromClientId, "peerConnectionRole"],
            "OFFER"
          );

          peerConnectionManager.createOffer().then((offer) => {
            this.dispatchEvent(
              new CustomEvent("offeravailable", {
                detail: { clientId: fromClientId, offer },
              })
            );
          });
        }
        break;
      }
      case "answer": {
        this.clients
          .getIn([fromClientId, "peerConnectionManager"])
          .setAnswer(messageData);
        break;
      }
      case "offer": {
        this.clients
          .getIn([fromClientId, "peerConnectionManager"])
          .setOfferAndCreateAnswer(messageData)
          .then((answer) => {
            this.dispatchEvent(
              new CustomEvent("answeravailable", {
                detail: { clientId: fromClientId, answer },
              })
            );
          });
        break;
      }
      default: {
        break;
      }
    }

    this.dispatchEvent(new CustomEvent("clients", { detail: this.clients }));
  };
}
