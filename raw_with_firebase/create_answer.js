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

export default async function (localStream, videoStack, peerRef) {
  const offerRef = child(peerRef, `offer`);
  const offerCandidatesRef = child(peerRef, `offerCandidates`);
  const answerCandidatesRef = child(peerRef, `answerCandidates`);

  const pc = createAndConfiguratePeerConnection(SERVERS);

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      const candidate = event.candidate;

      console.log("Sending an answer ICE: " + candidate.candidate);

      const answerCandidateRef = push(answerCandidatesRef);
      await set(answerCandidateRef, candidate.toJSON());
    } else {
      console.log("ICE gathering has finished.");
    }
  };

  pc.ontrack = (event) => {
    const track = event.track;

    console.log("On remote track: kind = " + track.kind + ", id = " + track.id);

    addVideo(videoStack, peerRef.key, event.track);
  };

  pc.onnegotiationneeded = () => {
    console.log("On negotiation needed.");
  };

  localStream.getTracks().forEach((track) => {
    console.log("Add track to connection: kind = " + track.kind);

    pc.addTrack(track, localStream);
  });

  console.log("Fetching the offer SDP.");

  const offerSnap = await get(offerRef);

  console.log("Setting the offer SDP.");

  await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.val()));

  console.log("Creating answer.");

  const answerDescription = await pc.createAnswer();

  console.log("Setting the local SDP.");

  await pc.setLocalDescription(answerDescription);

  console.log("Sending answer.");

  await update(peerRef, {
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    },
  });

  onChildAdded(offerCandidatesRef, async (snap) => {
    console.log("Received offer ICE.");

    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}
