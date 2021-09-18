import { collection, doc, addDoc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

const SERVERS = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ],
  iceCandidatePoolSize: 10,
};

async function initRoom(db, callId) {
  const pc = new RTCPeerConnection(SERVERS);

  const webcamVideo = document.querySelector('#webcamVideo');
  webcamVideo.muted = true; // Avoid echo on local video
  const remoteVideo = document.querySelector('#remoteVideo');

  // const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  const callCol = collection(db, 'calls');
  const callDoc = doc(callCol, callId);
  const callSnap = await getDoc(callDoc);

  if (callSnap.exists()) {
    await joinCall(pc, db, callCol, callDoc);
  } else {
    await createCall(pc, db, callCol, callDoc);
  }

  const roomPageContainer = document.querySelector('#room-page');
  roomPageContainer.style.display = 'block';
}

async function createCall(pc, db, callCol, callDoc) {
  const offerCandidates = collection(callCol, callDoc.id, 'offerCandidates');
  const answerCandidates = collection(callCol, callDoc.id, 'answerCandidates');

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    type: offerDescription.type,
    sdp: offerDescription.sdp,
  };

  await setDoc(callDoc, { offer });

  onSnapshot(callDoc, snapshot => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  onSnapshot(answerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
}

async function joinCall(pc, db, callCol, callDoc) {
  const offerCandidates = collection(callCol, callDoc.id, 'offerCandidates');
  const answerCandidates = collection(callCol, callDoc.id, 'answerCandidates');

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  const callSnap = await getDoc(callDoc);
  const callData = callSnap.data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await updateDoc(callDoc, { answer });

  onSnapshot(offerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
}

export default function (db) {
  const callId = location.pathname.substr(1);

  const confirmJoinRoomButton = document.querySelector('#confirm-join-room-btn');
  const roomPageConfirmJoinContainer = document.querySelector('#room-page-confirm-join');

  confirmJoinRoomButton.innerHTML = `Join room <pre class="confirm-join-room-btn-room-id">${callId}</pre>`;
  confirmJoinRoomButton.onclick = async (event) => {
    roomPageConfirmJoinContainer.style.display = 'none';
    const roomPageJoiningContainer = document.querySelector('#room-page-joining');
    roomPageJoiningContainer.display = 'block';

    await initRoom(db, callId);

    roomPageJoiningContainer.display = 'none';
  };

  roomPageConfirmJoinContainer.style.display = 'flex';
}
