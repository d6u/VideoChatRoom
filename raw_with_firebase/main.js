import "./style.css";
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import front from "./front";
import room from "./room";

const firebaseConfig = {
  apiKey: "AIzaSyAFBaYPFD-OCoUIgjaBPcG-I2tYOMf34RQ",
  authDomain: "webrtc-raw-with-firebase.firebaseapp.com",
  projectId: "webrtc-raw-with-firebase",
  storageBucket: "webrtc-raw-with-firebase.appspot.com",
  messagingSenderId: "844439768408",
  appId: "1:844439768408:web:0d4f8c96c89b5e2697e92d",
};

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase();

  if (location.pathname === "/") {
    front(db);
  } else {
    const roomId = location.pathname.substr(1);
    room(db, roomId);
  }
}

main();
