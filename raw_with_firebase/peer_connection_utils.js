export function createAndConfiguratePeerConnection(servers) {
  console.log("Creating new peer connection.");

  const pc = new RTCPeerConnection(servers);

  pc.onsignalingstatechange = (event) => {
    console.log("Signaling state change: " + pc.signalingState);
  };

  pc.onconnectionstatechange = (event) => {
    console.log("Connection state change: " + pc.connectionState);
  };

  pc.onicegatheringstatechange = (event) => {
    console.log(
      "Connection ICE gathering state change: " + pc.iceGatheringState
    );
  };

  pc.oniceconnectionstatechange = (event) => {
    console.log("Connection ICE state change: " + pc.iceConnectionState);
  };

  return pc;
}
