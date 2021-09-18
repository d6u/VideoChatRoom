import './style.css'

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getFirestore, collection, doc, addDoc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAFBaYPFD-OCoUIgjaBPcG-I2tYOMf34RQ",
  authDomain: "webrtc-raw-with-firebase.firebaseapp.com",
  projectId: "webrtc-raw-with-firebase",
  storageBucket: "webrtc-raw-with-firebase.appspot.com",
  messagingSenderId: "844439768408",
  appId: "1:844439768408:web:0d4f8c96c89b5e2697e92d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const webcamButton = document.querySelector('#webcamButton');
const webcamVideo = document.querySelector('#webcamVideo');
webcamVideo.muted = true; // avoid echo on local video
const callButton = document.querySelector('#callButton');
const callInput = document.querySelector('#callInput');
const answerButton = document.querySelector('#answerButton');
const remoteVideo = document.querySelector('#remoteVideo');
const hangupButton = document.querySelector('#hangupButton');

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  remoteStream = new MediaStream();

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

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

callButton.onclick = async () => {
  const callCol = collection(db, 'calls');
  const callDoc = doc(callCol);

  const offerCandidates = collection(db, 'calls', callDoc.id, 'offerCandidates');
  const answerCandidates = collection(db, 'calls', callDoc.id, 'answerCandidates');

  callInput.value = callDoc.id;

  pc.onicecandidate = event => {
    event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
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

  hangupButton.disabled = false;
};

answerButton.onclick = async () => {
  const callId = callInput.value;
  if (!callId) {
    return;
  }

  const callCol = collection(db, 'calls');
  const callDoc = doc(callCol, callId);

  const offerCandidates = collection(db, 'calls', callDoc.id, 'offerCandidates');
  const answerCandidates = collection(db, 'calls', callDoc.id, 'answerCandidates');

  pc.onicecandidate = event => {
    event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
  };

  const callData = (await getDoc(callDoc)).data();

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
    })
  })
};
