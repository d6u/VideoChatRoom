import { getFirestore, collection, doc, addDoc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

export default function (db) {
  const frontPageContainer = document.querySelector('#front-page');
  frontPageContainer.style.display = 'flex';

  const createRoomButton = document.querySelector('#create-room-btn');
  createRoomButton.onclick = event => {
    const callCol = collection(db, 'calls');
    const callDoc = doc(callCol);
    location.pathname = '/' + callDoc.id;
  };
}
