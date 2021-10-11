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
import { VideoStack } from "./video_stack";
import createOffer from "./create_offer";
import createAnswer from "./create_answer";

export default function (db, roomId) {
  const confirmJoinRoomButton = document.querySelector(
    "#confirm-join-room-btn"
  );
  const roomPageConfirmJoinContainer = document.querySelector(
    "#room-page-confirm-join"
  );
  const roomPageJoiningContainer = document.querySelector("#room-page-joining");

  confirmJoinRoomButton.innerHTML = `Join room <pre class="confirm-join-room-btn-room-id">${roomId}</pre>`;

  confirmJoinRoomButton.onclick = async (event) => {
    roomPageConfirmJoinContainer.style.display = "none";
    roomPageJoiningContainer.style.display = "flex";

    await initRoom(db, roomId);

    roomPageJoiningContainer.style.display = "none";
  };

  roomPageConfirmJoinContainer.style.display = "flex";
}

async function initRoom(db, roomId) {
  console.log("Initialize room.");

  const videoStack = new VideoStack();

  const webcamVideo = document.querySelector("#webcamVideo");
  webcamVideo.muted = true; // Avoid echo on local video

  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  webcamVideo.srcObject = localStream;

  const roomRef = ref(db, `rooms/${roomId}`);
  const roomSnap = await get(roomRef);

  if (!roomSnap.exists()) {
    alert("Room doesn't exit.");
    return;
  }

  const clientsRef = child(roomRef, `clients`);

  onValue(ref(db, ".info/connected"), async (snap) => {
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
      createAnswer(localStream, videoStack, snap.ref);
    });

    onValue(
      clientsRef,
      async (snap) => {
        // cannot use async in forEach callback, otherwise it only execute the first one
        snap.forEach((clientSnap) => {
          if (clientSnap.key === currentClientRef.key) {
            return;
          }

          console.log(
            `found exiting client (key = ${clientSnap.key}), joining...`
          );
          createOffer(
            localStream,
            videoStack,
            roomRef,
            currentClientRef,
            clientSnap.ref
          );
        });
      },
      { onlyOnce: true }
    );
  });

  const debugInfoContainer = document.querySelector("#debug-info");
  onValue(roomRef, async (snap) => {
    debugInfoContainer.innerHTML = JSON.stringify(snap.val(), null, 4);
  });

  const roomPageContainer = document.querySelector("#room-page");
  roomPageContainer.style.display = "block";
}

async function handupCall(videoStack, clientKey) {
  videoStack.recycleVideo(clientKey);
}
