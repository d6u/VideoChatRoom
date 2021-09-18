import { ref, onValue, push, onDisconnect, set, child, get, onChildAdded, onChildRemoved, update, increment } from "firebase/database";
import VideoStack from "./video_stack";
import { SERVERS } from './config';

export default function (db, roomId) {
  const confirmJoinRoomButton = document.querySelector('#confirm-join-room-btn');
  const roomPageConfirmJoinContainer = document.querySelector('#room-page-confirm-join');
  const roomPageJoiningContainer = document.querySelector('#room-page-joining');

  confirmJoinRoomButton.innerHTML = `Join room <pre class="confirm-join-room-btn-room-id">${roomId}</pre>`;

  confirmJoinRoomButton.onclick = async (event) => {
    roomPageConfirmJoinContainer.style.display = 'none';
    roomPageJoiningContainer.style.display = 'flex';

    await initRoom(db, roomId);

    roomPageJoiningContainer.style.display = 'none';
  };

  roomPageConfirmJoinContainer.style.display = 'flex';
}

async function initRoom(db, roomId) {
  const videoStack = new VideoStack();

  const webcamVideo = document.querySelector('#webcamVideo');
  webcamVideo.muted = true; // Avoid echo on local video

  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  webcamVideo.srcObject = localStream;

  const roomRef = ref(db, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);

  if (!roomSnap.exists()) {
    alert("Room doesn't exit.");
    return;
  }

  const clientsRef = child(roomRef, `clients`);

  onValue(ref(db, '.info/connected'), async (snap) => {
    if (!snap.val()) {
      return;
    }

    const currentClientRef = push(clientsRef);

    // disconnect hooks
    onDisconnect(currentClientRef).remove();
    onDisconnect(roomRef).update({ clientsCount: increment(-1) });

    await update(roomRef, { clientsCount: increment(1) });
    await set(currentClientRef, { isOnline: true });

    onChildRemoved(clientsRef, async (snap) => {
      console.log(`client offlien: key = ${snap.key}`);
      handupCall(videoStack, snap.key);
    });

    const peersRef = child(currentClientRef, `peers`);

    onChildAdded(peersRef, async (snap) => {
      console.log(`new peer added: key = ${snap.key}`);
      answerCall(localStream, videoStack, snap.ref);
    });

    onValue(clientsRef, async (snap) => {
      // cannot use async in forEach callback, otherwise it only execute the first one
      snap.forEach((clientSnap) => {
        if (clientSnap.key === currentClientRef.key) {
          return;
        }

        console.log(`found exiting client (key = ${clientSnap.key}), joining...`);
        offerCall(localStream, videoStack, roomRef, currentClientRef, clientSnap.ref);
      });
    }, { onlyOnce: true });
  });

  const debugInfoContainer = document.querySelector('#debug-info');
  onValue(roomRef, async (snap) => {
    debugInfoContainer.innerHTML = JSON.stringify(snap.val(), null, 4);
  });

  const roomPageContainer = document.querySelector('#room-page');
  roomPageContainer.style.display = 'block';
}

async function offerCall(localStream, videoStack, roomRef, currentClientRef, targetClientRef) {
  const pc = new RTCPeerConnection(SERVERS);

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = event => {
    addVideo(videoStack, targetClientRef.key, event.streams[0]);
  };

  const peerRef = child(targetClientRef, `peers/${currentClientRef.key}`);
  const offerCandidatesRef = child(peerRef, `offerCandidates`);
  const answerRef = child(peerRef, `answer`);
  const answerCandidatesRef = child(peerRef, `answerCandidates`);

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      const offerCandidateRef = push(offerCandidatesRef);
      await set(offerCandidateRef, event.candidate.toJSON());
    }
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  await update(peerRef, {
    offer: {
      type: offerDescription.type,
      sdp: offerDescription.sdp,
    }
  });

  onValue(answerRef, async (snap) => {
    console.log('answer changed', snap.val());
    if (!pc.currentRemoteDescription && snap.exists()) {
      pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
    }
  });

  onChildAdded(answerCandidatesRef, snap => {
    console.log('answer candidate added', snap.val());
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}

async function answerCall(localStream, videoStack, peerRef) {
  const pc = new RTCPeerConnection(SERVERS);

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = event => {
    addVideo(videoStack, peerRef.key, event.streams[0]);
  };

  const offerRef = child(peerRef, `offer`);
  const offerCandidatesRef = child(peerRef, `offerCandidates`);
  const answerCandidatesRef = child(peerRef, `answerCandidates`);

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      const answerCandidateRef = push(answerCandidatesRef);
      await set(answerCandidateRef, event.candidate.toJSON());
    }
  };

  const offerSnap = await get(offerRef);

  await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.val()));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  await update(peerRef, {
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    }
  });

  onChildAdded(offerCandidatesRef, async (snap) => {
    console.log('offer candidate added', snap.val());
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}

async function handupCall(videoStack, clientKey) {
  videoStack.recycleVideo(clientKey);
}

async function addVideo(videoStack, clientKey, stream) {
  const video = videoStack.getVideoIfAvailable(clientKey);
  if (!video) {
    alert("Cannot add more calls.");
    return;
  }

  const remoteStream = new MediaStream();
  video.srcObject = remoteStream;

  stream.getTracks().forEach(track => {
    remoteStream.addTrack(track);
  });
}
