import PeerConnectionManager from "./PeerConnectionManager";

export default class PeerConnectionsManager extends EventTarget {
  isStopped = false;

  currentClientId = null;
  clientIds = [];
  oldClientIds = [];

  clients = {};

  constructor() {
    super();
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
    this.clientIds = clientIds;
    this.dispatchEvent(new Event("data"));
  }

  handleData = () => {
    // === Clean up old client info ===

    for (const clientId of this.oldClientIds) {
      if (this.clientIds.indexOf(clientId) > -1) {
        continue;
      }
      if (this.clients[clientId].peerConnectionManager != null) {
        this.clients[clientId].peerConnectionManager.destroy();
      }
      this.clients[clientId] = null;
    }

    // === Creating new client info ===

    for (const clientId of this.clientIds) {
      if (this.clients[clientId] == null) {
        this.clients[clientId] = {};
      }

      const connectionRole =
        this.currentClientId == null
          ? "UNKNOWN"
          : clientId === this.currentClientId
          ? "LOCAL"
          : "REMOTE";

      if (
        connectionRole === "REMOTE" &&
        this.clients[clientId].peerConnectionManager == null
      ) {
        const randomValue = Math.floor(Math.random() * (Math.pow(2, 31) - 1));
        this.dispatchEvent(
          new CustomEvent("selectleader", { detail: { clientId, randomValue } })
        );
        this.clients[clientId].localRandomValue = randomValue;
      }

      this.clients[clientId].connectionRole = connectionRole;
    }

    this.dispatchEvent(new CustomEvent("clients", { detail: this.clients }));
  };

  handleConnectClient = (event) => {
    const { fromClientId, messageData } = event.detail;
    switch (messageData.type) {
      case "SelectingLeader": {
        if (this.clients[fromClientId] != null) {
          if (
            this.clients[fromClientId].localRandomValue <
            messageData.randomValue
          ) {
            this.clients[fromClientId].peerConnectionRole = "ANSWER";
          } else {
            this.clients[fromClientId].peerConnectionRole = "OFFER";

            const peerConnectionManager = new PeerConnectionManager(
              fromClientId
            );
            this.clients[fromClientId].peerConnectionManager =
              peerConnectionManager;

            // peerConnectionManager.
          }
        }
        break;
      }
      default: {
        break;
      }
    }
    this.dispatchEvent(new CustomEvent("clients", { detail: this.clients }));
  };
}
