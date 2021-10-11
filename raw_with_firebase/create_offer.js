import { SERVERS } from "./config";
import { addVideo } from "./video_stack";
import {
  ref,
  onValue,
  push,
  onDisconnect,
  set,
  child,
  get,
  onChildAdded,
  onChildRemoved,
  update,
  increment,
} from "firebase/database";
import { createAndConfiguratePeerConnection } from "./peer_connection_utils";

export default async function (
  localStream,
  videoStack,
  roomRef,
  currentClientRef,
  targetClientRef
) {
  const peerRef = child(targetClientRef, `peers/${currentClientRef.key}`);
  const offerCandidatesRef = child(peerRef, `offerCandidates`);
  const answerRef = child(peerRef, `answer`);
  const answerCandidatesRef = child(peerRef, `answerCandidates`);

  const pc = createAndConfiguratePeerConnection(SERVERS);

  pc.ontrack = (event) => {
    const track = event.track;

    console.log("On remote track: kind = " + track.kind + ", id = " + track.id);

    addVideo(videoStack, targetClientRef.key, track);
  };

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      const candidate = event.candidate;

      console.log("Sending an offer ICE: " + candidate.candidate);

      const offerCandidateRef = push(offerCandidatesRef);
      await set(offerCandidateRef, event.candidate.toJSON());
    } else {
      console.log("ICE gathering has finished.");
    }
  };

  pc.onnegotiationneeded = async () => {
    await onNegotiationNeeded(pc, peerRef, answerRef, answerCandidatesRef);
  };

  localStream.getTracks().forEach((track) => {
    console.log("Add track to connection: type = " + track.kind);

    // Adding a track will trigger onnegotiationneeded
    pc.addTrack(track, localStream);
  });
}

async function onNegotiationNeeded(
  pc,
  peerRef,
  answerRef,
  answerCandidatesRef
) {
  console.log("On negotiation needed.");
  console.log("Creating an offer.");

  const offerDescription = await pc.createOffer();

  console.log("Setting the local SDP.");

  await pc.setLocalDescription(offerDescription);

  console.log("Sending the offer.");

  await update(peerRef, {
    offer: {
      type: offerDescription.type,
      sdp: offerDescription.sdp,
    },
  });

  onValue(answerRef, async (snap) => {
    if (!pc.currentRemoteDescription && snap.exists()) {
      console.log("Received answer.");

      await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
    }
  });

  onChildAdded(answerCandidatesRef, (snap) => {
    console.log("Received answer ICE.");

    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}
