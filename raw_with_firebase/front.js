import { ref, onValue, push, onDisconnect, set, serverTimestamp } from "firebase/database";

export default function (db) {
  const frontPageContainer = document.querySelector('#front-page');
  frontPageContainer.style.display = 'flex';

  const createRoomButton = document.querySelector('#create-room-btn');
  createRoomButton.onclick = async (event) => {
    const roomsRef = ref(db, 'rooms');
    const room = push(roomsRef);
    await set(room, { key: room.key });
    location.pathname = '/' + room.key;
  };
}
