import { ref, onValue, push, onDisconnect, set, child, get, onChildAdded, update } from "firebase/database";

const SERVERS = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ],
  iceCandidatePoolSize: 10,
};

async function initRoom(db, roomId) {
  const webcamVideo = document.querySelector('#webcamVideo');
  webcamVideo.muted = true; // Avoid echo on local video

  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  webcamVideo.srcObject = localStream;

  const roomRef = ref(db, `rooms/${roomId}`);
  const room = await get(roomRef);

  if (!room.exists()) {
    alert("Room doesn't exit.");
    return;
  }

  const clientsRef = ref(db, `rooms/${roomId}/clients`);
  const clients = await get(clientsRef);

  if (clients.exists()) {
    for (const clientKey of Object.keys(clients.val())) {
      await createCall(db, roomId, clientKey, localStream);
    }
  } else {
    onValue(ref(db, '.info/connected'), async (snap) => {
      if (snap.val()) {
        const clientRef = push(clientsRef);
        onDisconnect(clientRef).remove();
        set(clientRef, true);

        const offerRef = child(clientRef, `offer`);
        onValue(offerRef, async (snap) => {
          console.log('offer changed', snap.exists(), snap.val());
          if (snap.exists() && snap.val()) {
            const offer = snap.val();
            joinCall(db, roomId, clientRef, offer, localStream);
          }
        });
      }
    });
  }

  const roomPageContainer = document.querySelector('#room-page');
  roomPageContainer.style.display = 'block';
}

async function createCall(db, roomId, clientKey, localStream) {
  const pc = new RTCPeerConnection(SERVERS);

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = event => {
    addVideo(event.streams[0]);
  };

  const clientRef = ref(db, `rooms/${roomId}/clients/${clientKey}`);
  const answerRef = child(clientRef, `answer`);
  const offerCandidatesRef = child(clientRef, `offerCandidates`);
  const answerCandidatesRef = child(clientRef, `answerCandidates`);

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      const offerCandidateRef = push(offerCandidatesRef);
      await set(offerCandidateRef, event.candidate.toJSON());
    }
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    type: offerDescription.type,
    sdp: offerDescription.sdp,
  };

  await update(clientRef, { offer });

  onValue(answerRef, (snap) => {
    console.log('answer changed', snap.exists(), snap.val());
    if (!pc.currentRemoteDescription && snap.exists()) {
      const answerDescription = new RTCSessionDescription(snap.val());
      pc.setRemoteDescription(answerDescription);
    }
  });

  onChildAdded(answerCandidatesRef, snap => {
    console.log('answer candidate added', snap.exists(), snap.val());
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}

async function joinCall(db, roomId, clientRef, offer, localStream) {
  const pc = new RTCPeerConnection(SERVERS);

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = event => {
    addVideo(event.streams[0]);
  };

  const offerCandidatesRef = child(clientRef, `offerCandidates`);
  const answerCandidatesRef = child(clientRef, `answerCandidates`);

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      const answerCandidateRef = push(answerCandidatesRef);
      await set(answerCandidateRef, event.candidate.toJSON());
    }
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await update(clientRef, { answer });

  onChildAdded(offerCandidatesRef, (snap) => {
    console.log('offer candidate added', snap.exists(), snap.val());
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}

async function addVideo(stream) {
  // stream.getTracks().forEach(track => {
  //   const remoteId = track.kind + track.label;
  //   remoteStream.addTrack(track);
  // });

  // const video = Array.from(document.querySelectorAll('.remote-video')).find(video => {
  //   return video.dataset.remoteId;
  // });

  const video = Array.from(document.querySelectorAll('.remote-video'))[0];

  const remoteStream = new MediaStream();
  video.srcObject = remoteStream;

  stream.getTracks().forEach(track => {
    const remoteId = track.kind + track.label;
    remoteStream.addTrack(track);
  });
}

export default function (db, roomId) {
  const confirmJoinRoomButton = document.querySelector('#confirm-join-room-btn');
  const roomPageConfirmJoinContainer = document.querySelector('#room-page-confirm-join');

  confirmJoinRoomButton.innerHTML = `Join room <pre class="confirm-join-room-btn-room-id">${roomId}</pre>`;
  confirmJoinRoomButton.onclick = async (event) => {
    roomPageConfirmJoinContainer.style.display = 'none';
    const roomPageJoiningContainer = document.querySelector('#room-page-joining');
    roomPageJoiningContainer.display = 'block';

    await initRoom(db, roomId);

    roomPageJoiningContainer.display = 'none';
  };

  roomPageConfirmJoinContainer.style.display = 'flex';
}
