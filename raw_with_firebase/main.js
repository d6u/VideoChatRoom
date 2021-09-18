import './style.css';
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import room from './room';
import front from './front';

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

if (location.pathname === '/') {
  front(db);
} else {
  room(db);
}
