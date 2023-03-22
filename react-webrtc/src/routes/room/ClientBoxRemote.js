import { useEffect, useRef, useState } from "react";
import { filter, from, mergeMap } from "rxjs";
import classNames from "classnames";
import PeerConnectionManager from "../../utils/PeerConnectionManager";

export default function ClientBoxRemote({
  clientId,
  wsMessageObserver,
  onWsMessage,
  localMediaStreamSubject,
}) {
  const refVideo = useRef(null);
  const refPcm = useRef(null);

  const [peerConnectionRole, setPeerConnectionRole] = useState("UNKNOWN");

  useEffect(() => {
    refPcm.current = new PeerConnectionManager(clientId);
    refPcm.current.createConnection();

    return () => {
      refPcm.current.destroy();
    };
  }, [clientId]);

  useEffect(() => {
    const subscriptions = [];

    const randomValue = Math.floor(Math.random() * (Math.pow(2, 31) - 1));
    let hasKnownPeerConnection = false;
    let peerConnectionRoleLocal = null;

    // Defer executing to avoid immediate clean up in useEffect()
    const timeoutHandler = setTimeout(() => {
      onWsMessage({
        action: "ConnectClient",
        targetClientId: clientId,
        messageData: {
          type: "SelectingLeader",
          randomValue,
        },
      });
    });

    subscriptions.push(
      wsMessageObserver
        .pipe(
          filter(
            (m) =>
              !m.isDelta &&
              m.type === "ConnectClient" &&
              m.fromClientId === clientId
          )
        )
        .subscribe(({ messageData }) => {
          function handleLeaderSetting() {
            if (!hasKnownPeerConnection) {
              hasKnownPeerConnection = true;

              if (randomValue > messageData.randomValue) {
                peerConnectionRoleLocal = "OFFER";
                setPeerConnectionRole("OFFER");
              } else {
                peerConnectionRoleLocal = "ANSWER";
                setPeerConnectionRole("ANSWER");
              }

              onWsMessage({
                action: "ConnectClient",
                targetClientId: clientId,
                messageData: {
                  type: "ConfirmingLeader",
                  randomValue,
                },
              });
            }
          }

          switch (messageData.type) {
            case "SelectingLeader":
              handleLeaderSetting();
              break;
            case "ConfirmingLeader":
              handleLeaderSetting();

              subscriptions.push(
                refPcm.current.localIceCandidatesSubject.subscribe((cand) =>
                  onWsMessage({
                    action: "ConnectClient",
                    targetClientId: clientId,
                    messageData: cand,
                  })
                ),
                refPcm.current.negotiationNeededSubject.subscribe(() => {
                  subscriptions.push(
                    from(refPcm.current.createOffer()).subscribe((offer) =>
                      onWsMessage({
                        action: "ConnectClient",
                        targetClientId: clientId,
                        messageData: offer,
                      })
                    )
                  );
                }),
                refPcm.current.tracksSubject.subscribe((event) => {
                  if (event.streams != null && event.streams[0] != null) {
                    refVideo.current.srcObject = event.streams[0];
                  } else {
                    if (refVideo.current.srcObject == null) {
                      refVideo.current.srcObject = new MediaStream();
                    }
                    refVideo.current.srcObject.addTrack(event.track);
                  }
                }),
                localMediaStreamSubject.subscribe((mediaStream) => {
                  if (mediaStream != null) {
                    mediaStream.getTracks().forEach((track) => {
                      refPcm.current.addTrack(track, mediaStream);
                    });
                  }
                })
              );
              break;
            case "offer":
            case "answer":
              let obs = null;
              if (
                messageData.type === "offer" &&
                refPcm.current.getSignalingState() !== "stable"
              ) {
                if (peerConnectionRoleLocal === "OFFER") {
                  break;
                }
                obs = from(
                  Promise.all([
                    refPcm.current
                      .getPc()
                      .setLocalDescription(
                        new RTCSessionDescription({ type: "rollback" })
                      ),
                    refPcm.current
                      .getPc()
                      .setRemoteDescription(
                        new RTCSessionDescription(messageData)
                      ),
                  ])
                );
              } else {
                obs = from(
                  refPcm.current
                    .getPc()
                    .setRemoteDescription(
                      new RTCSessionDescription(messageData)
                    )
                );
              }
              if (messageData.type === "offer") {
                subscriptions.push(
                  obs
                    .pipe(mergeMap(() => from(refPcm.current.createAnswer())))
                    .subscribe((answer) => {
                      onWsMessage({
                        action: "ConnectClient",
                        targetClientId: clientId,
                        messageData: answer,
                      });
                    })
                );
              }
              break;
            default:
              refPcm.current
                .addIceCandidate(messageData)
                .catch((error) => console.error("addIceCandidate", error));
              break;
          }
        })
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }

      clearTimeout(timeoutHandler);
    };
  }, [clientId, localMediaStreamSubject, wsMessageObserver, onWsMessage]);

  return (
    <div className={classNames({ "Room_single-video-container": true })}>
      <div>
        <code>
          (REMOTE) {`(${peerConnectionRole})`} {clientId}
        </code>
      </div>
      <video
        ref={refVideo}
        width={320}
        height={240}
        muted={true}
        autoPlay
        playsInline
      />
    </div>
  );
}
