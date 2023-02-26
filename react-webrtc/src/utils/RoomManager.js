import * as RealtimeDatabase from "firebase/database";
import PeerConnectionManager from "./PeerConnectionManager";

// onDatabaseConnected(callback) {
//   this.unsubscribeConnectedListener = RealtimeDatabase.onValue(
//     RealtimeDatabase.ref(this.database, ".info/connected"),
//     (connectedSnap) => {
//       if (this.isDestroyed) {
//         return;
//       }
//       callback(connectedSnap.val());
//     }
//   );
// }

export default class RoomManager {
  isDestroyed = false;

  onRemoteTrackAvailableListeners = new Set();
  peerConnectionEndedListeners = new Set();
  unsubscribeAnswerOnValueListeners = new Set();
  unsubscribeAnswerCandidatesOnChildAddedListeners = new Set();
  unsubscribeOfferCandidatesOnChildAddedListeners = new Set();

  peerConnectionManagers = new Map();

  constructor(database, roomId) {
    this.database = database;
    this.roomId = roomId;
    this.roomRef = RealtimeDatabase.ref(this.database, `rooms/${this.roomId}`);
  }

  setLocalMediaStream(mediaStream) {
    this.localMediaStream = mediaStream;
  }

  // Clean up logic is needed for database.
  // There are two cases we need to clean up:
  // 1. When navigating away from this page (with page reload).
  // 2. When navigating away from this view (no page reload).
  async joinCurrentRoom() {
    this.clientsRef = RealtimeDatabase.child(this.roomRef, `clients`);

    // Add a new client as the current client to existing clients list.
    this.currentClientRef = RealtimeDatabase.push(this.clientsRef);
    console.log(`Current client key is ${this.currentClientRef.key}.`);

    // This handles database clean up #1
    this.onDisconnectInstance = RealtimeDatabase.onDisconnect(
      this.currentClientRef
    );
    this.onDisconnectInstance.remove();

    // Insert current client to clients
    RealtimeDatabase.set(this.currentClientRef, {
      timestamp: RealtimeDatabase.serverTimestamp(),
    });

    this.unsubscribeClientsOnChildRemovedListener =
      RealtimeDatabase.onChildRemoved(this.clientsRef, async (clientSnap) => {
        console.log(`Client ${clientSnap.key} went offline.`);
        // handupCall(videoStack, clientSnap.key);
      });

    this.unsubscribeIncomingConnectionsOnChildAddedListener =
      RealtimeDatabase.onChildAdded(
        RealtimeDatabase.child(this.currentClientRef, `incomingConnections`),
        async (incomingConnectionSnap) => {
          console.log(
            `New incoming connection ${incomingConnectionSnap.key} added.`
          );
          this.handleIncomingConnection(incomingConnectionSnap.ref);
        }
      );

    // Client joined later will always initiate the call by creating the offer.
    // Earlier clients will wait by watching their own peers node.
    // Note: This will only execute once.

    this.unsubscribeClientsOnValueListener = RealtimeDatabase.onValue(
      this.clientsRef,
      async (clientsSnap) => {
        if (this.isDestroyed) {
          return;
        }
        // Cannot use async in forEach() callback, because return "true" will
        // execute cancel the next enumeration.
        clientsSnap.forEach((clientSnap) => {
          if (this.isDestroyed) {
            return true;
          }
          if (clientSnap.key === this.currentClientRef.key) {
            return;
          }
          this.startConnectonWithClient(clientSnap.ref);
        });
      },
      { onlyOnce: true }
    );

    return true;
  }

  addOnRemoteTrackAvailableListener(listener) {
    this.onRemoteTrackAvailableListeners.add(listener);
  }

  removeOnRemoteTrackAvailableListener(listener) {
    this.onRemoteTrackAvailableListeners.delete(listener);
  }

  addPeerConnectionEndedListener(listener) {
    this.peerConnectionEndedListeners.add(listener);
  }

  removePeerConnectionEndedListener(listener) {
    this.peerConnectionEndedListeners.delete(listener);
  }

  async startConnectonWithClient(targetClientRef) {
    const incomingConnectionRef = RealtimeDatabase.child(
      targetClientRef,
      `incomingConnections/${this.currentClientRef.key}`
    );

    // Setup connection

    const peerConnectionManager = new PeerConnectionManager(
      targetClientRef.key
    );

    this.peerConnectionManagers.set(targetClientRef.key, peerConnectionManager);

    peerConnectionManager.addOnPeerConnectionEndListener(() => {
      for (const listener of this.peerConnectionEndedListeners) {
        listener(targetClientRef.key);
      }
    });

    peerConnectionManager.addOnRemoteTrackAvailableListener((track) => {
      for (const listener of this.onRemoteTrackAvailableListeners) {
        listener(targetClientRef.key, track);
      }
    });

    peerConnectionManager.addOnIceCandidateListener(async (candidate) => {
      const ref = RealtimeDatabase.push(
        RealtimeDatabase.child(incomingConnectionRef, `offerCandidates`)
      );
      await RealtimeDatabase.set(ref, candidate.toJSON());
    });

    peerConnectionManager.createConnection();

    // Setup listener with database

    this.unsubscribeAnswerOnValueListeners.add(
      RealtimeDatabase.onValue(
        RealtimeDatabase.child(incomingConnectionRef, `answer`),
        async (answerSnap) => {
          if (answerSnap.exists()) {
            await peerConnectionManager.setAnswer(answerSnap.val());
          }
        }
      )
    );

    this.unsubscribeAnswerCandidatesOnChildAddedListeners.add(
      RealtimeDatabase.onChildAdded(
        RealtimeDatabase.child(incomingConnectionRef, `answerCandidates`),
        (answerCandidateSnap) => {
          peerConnectionManager.addIceCandidate(answerCandidateSnap.val());
        }
      )
    );

    this.addLocalTracksToPeerConnectionManager(peerConnectionManager);

    const offer = await peerConnectionManager.createOffer();

    if (this.isDestroyed) {
      return;
    }

    await RealtimeDatabase.update(incomingConnectionRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
    });
  }

  async handleIncomingConnection(incomingConnectionRef) {
    // Setup connection

    const peerConnectionManager = new PeerConnectionManager(
      incomingConnectionRef.key
    );

    this.peerConnectionManagers.set(
      incomingConnectionRef.key,
      peerConnectionManager
    );

    peerConnectionManager.addOnPeerConnectionEndListener(() => {
      for (const listener of this.peerConnectionEndedListeners) {
        listener(incomingConnectionRef.key);
      }
    });

    peerConnectionManager.addOnRemoteTrackAvailableListener((track) => {
      for (const listener of this.onRemoteTrackAvailableListeners) {
        listener(incomingConnectionRef.key, track);
      }
    });

    peerConnectionManager.addOnIceCandidateListener(async (candidate) => {
      const ref = RealtimeDatabase.push(
        RealtimeDatabase.child(incomingConnectionRef, `answerCandidates`)
      );
      await RealtimeDatabase.set(ref, candidate.toJSON());
    });

    peerConnectionManager.createConnection();

    this.addLocalTracksToPeerConnectionManager(peerConnectionManager);

    const offerSnap = await RealtimeDatabase.get(
      RealtimeDatabase.child(incomingConnectionRef, `offer`)
    );

    if (this.isDestroyed) {
      return;
    }

    const answer = await peerConnectionManager.setOfferAndCreateAnswer(
      offerSnap.val()
    );

    if (this.isDestroyed) {
      return;
    }

    await RealtimeDatabase.update(incomingConnectionRef, {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });

    if (this.isDestroyed) {
      return;
    }

    this.unsubscribeOfferCandidatesOnChildAddedListeners.add(
      RealtimeDatabase.onChildAdded(
        RealtimeDatabase.child(incomingConnectionRef, `offerCandidates`),
        async (offerCandidateSnap) => {
          await peerConnectionManager.addIceCandidate(offerCandidateSnap.val());
        }
      )
    );
  }

  addLocalTracksToPeerConnectionManager(peerConnectionManager) {
    for (const track of this.localMediaStream.getTracks()) {
      peerConnectionManager.addTrack(track, this.localMediaStream);
    }
  }

  destroy() {
    this.isDestroyed = true;

    if (this.unsubscribeIncomingConnectionsOnChildAddedListener != null) {
      this.unsubscribeIncomingConnectionsOnChildAddedListener();
      this.unsubscribeIncomingConnectionsOnChildAddedListener = null;
    }

    if (this.unsubscribeClientsOnValueListener != null) {
      this.unsubscribeClientsOnValueListener();
      this.unsubscribeClientsOnValueListener = null;
    }

    if (this.unsubscribeClientsOnChildRemovedListener != null) {
      this.unsubscribeClientsOnChildRemovedListener();
      this.unsubscribeClientsOnChildRemovedListener = null;
    }

    for (const unsubscribe of this.unsubscribeAnswerOnValueListeners) {
      unsubscribe();
    }

    for (const unsubscribe of this
      .unsubscribeAnswerCandidatesOnChildAddedListeners) {
      unsubscribe();
    }

    for (const unsubscribe of this
      .unsubscribeOfferCandidatesOnChildAddedListeners) {
      unsubscribe();
    }

    // Remove current client on disconnect

    if (this.onDisconnectInstance != null) {
      this.onDisconnectInstance.cancel();
      this.onDisconnectInstance = null;
    }

    if (this.currentClientRef != null) {
      RealtimeDatabase.remove(this.currentClientRef);
      this.currentClientRef = null;
    }

    // Clean peer connections

    for (const [, peerConnectionManager] of this.peerConnectionManagers) {
      peerConnectionManager.destroy();
    }
  }
}
