// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import './style.css'

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

document.querySelector('#app').innerHTML = `
  <h1>Hello Vite!</h1>
  <a href="https://vitejs.dev/guide/features.html" target="_blank">Documentation</a>
`
