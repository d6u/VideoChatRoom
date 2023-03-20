import { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import PeerConnectionManager from "../../utils/PeerConnectionManager";
import { filter, from } from "rxjs";

export default function ClientBox({
  clientId,
  localMediaStream,
  localClientId,
  wsMessageObserver,
  onWsMessage,
}) {
  const isLocal = localClientId != null && clientId === localClientId;
  const isRemote = localClientId != null && clientId !== localClientId;

  if (isLocal) {
    return (
      <ClientBoxLocal clientId={clientId} localMediaStream={localMediaStream} />
    );
  } else if (isRemote) {
    return (
      <ClientBoxRemote
        clientId={clientId}
        localMediaStream={localMediaStream}
        wsMessageObserver={wsMessageObserver}
        onWsMessage={onWsMessage}
      />
    );
  } else {
    return null;
  }
}

function ClientBoxLocal({ clientId, localMediaStream }) {
  const refVideo = useRef(null);

  useEffect(() => {
    refVideo.current.srcObject = localMediaStream;
  }, [localMediaStream]);

  return (
    <div
      className={classNames({
        "Room_single-video-container": true,
        "Room_single-video-container-self": true,
      })}
    >
      <div>
        <code>(LOCAL) {clientId}</code>
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

function ClientBoxRemote({
  clientId,
  localMediaStream,
  wsMessageObserver,
  onWsMessage,
}) {
  const refVideo = useRef(null);
  const refPcm = useRef(null);

  const [peerConnectionRole, setPeerConnectionRole] = useState("UNKNOWN");

  useEffect(() => {
    refPcm.current = new PeerConnectionManager(clientId);
    refPcm.current.createConnection();

    return () => {
      refPcm.current?.destroy();
    };
  }, [clientId]);

  useEffect(() => {
    if (localMediaStream != null) {
      localMediaStream.getTracks().forEach((track) => {
        refPcm.current.addTrack(track, localMediaStream);
      });
    }
  }, [localMediaStream]);

  useEffect(() => {
    const subscriptions = [];

    const randomValue = Math.floor(Math.random() * (Math.pow(2, 31) - 1));

    // Defer executing this to avoid thrashing this useEffect()
    const timeoutHandler = setTimeout(() => {
      onWsMessage({
        action: "ConnectClient",
        targetClientId: clientId,
        messageData: { type: "SelectingLeader", randomValue },
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
          switch (messageData.type) {
            case "SelectingLeader":
              subscriptions.push(
                refPcm.current.localIceCandidatesSubject.subscribe(
                  (candidate) =>
                    onWsMessage({
                      action: "ConnectClient",
                      targetClientId: clientId,
                      messageData: candidate,
                    })
                ),
                refPcm.current.tracksSubject.subscribe((track) => {
                  if (refVideo.current.srcObject == null) {
                    refVideo.current.srcObject = new MediaStream();
                  }
                  refVideo.current.srcObject.addTrack(track);
                })
              );

              if (randomValue > messageData.randomValue) {
                setPeerConnectionRole("OFFER");

                subscriptions.push(
                  from(refPcm.current.createOffer()).subscribe((offer) =>
                    onWsMessage({
                      action: "ConnectClient",
                      targetClientId: clientId,
                      messageData: offer,
                    })
                  )
                );
              } else {
                setPeerConnectionRole("ANSWER");

                subscriptions.push(
                  refPcm.current.answerSubject.subscribe((answer) =>
                    onWsMessage({
                      action: "ConnectClient",
                      targetClientId: clientId,
                      messageData: answer,
                    })
                  )
                );
              }
              break;
            case "offer":
              refPcm.current.setOffer(messageData);
              break;
            case "answer":
              refPcm.current.setAnswer(messageData);
              break;
            default:
              refPcm.current.addIceCandidate(messageData);
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
  }, [clientId, wsMessageObserver, onWsMessage]);

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
