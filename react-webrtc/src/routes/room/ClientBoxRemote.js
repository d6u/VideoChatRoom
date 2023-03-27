import { useCallback, useEffect, useRef, useState } from "react";
import {
  concatMap,
  defer,
  EMPTY,
  filter,
  from,
  map,
  mergeMap,
  Subscription,
  tap,
} from "rxjs";
import classNames from "classnames";
import webSocketManager from "../../utils/WebSocketManager";
import PeerConnectionManager from "../../utils/PeerConnectionManager";
import { useConst, useLogger } from "../../components/hooks";
import { sort } from "../../utils/operators";

function filterDirectMessage(clientId) {
  return function (data) {
    return (
      !data.isDelta &&
      data.type === "DirectMessage" &&
      data.fromClientId === clientId
    );
  };
}

export default function ClientBoxRemote({ clientId, localMediaStreamSubject }) {
  const logger = useLogger(`ClientBoxRemote(${clientId})`);
  const localLeaderSelectionRandomValue = useConst(() =>
    Math.floor(Math.random() * (Math.pow(2, 31) - 1))
  );

  const refSeq = useRef(0);
  const refVideo = useRef(null);
  const refPcm = useRef(null);

  const [stateIsPolite, setStateIsPolite] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    refPcm.current = new PeerConnectionManager();

    return () => {
      refPcm.current.destroy();
    };
  }, [clientId]);

  const send = useCallback(
    (message) => {
      const messageWithSeq = {
        ...message,
        seq: refSeq.current++,
      };
      logger.log(
        `==> [${messageWithSeq.seq}] [${messageWithSeq.type}]:`,
        messageWithSeq
      );
      webSocketManager.send({
        action: "DirectMessage",
        toClientId: clientId,
        message: messageWithSeq,
      });
    },
    [clientId, logger]
  );

  useEffect(() => {
    logger.debug(`useEffect() setup. clientId = ${clientId}`);

    const subscription = new Subscription();

    let hasKnownPeerConnectionRole = false;
    let isPolite = false;

    // Defer executing to avoid immediate clean up in useEffect()
    const timeoutHandler = setTimeout(() => {
      send({
        type: "SelectingLeader",
        randomValue: localLeaderSelectionRandomValue,
      });
    }, 200);

    const remoteMessagesObservable = webSocketManager.messagesSubject.pipe(
      filter(filterDirectMessage(clientId)),
      map((data) => data.message)
    );

    subscription.add(
      remoteMessagesObservable
        .pipe(
          sort({ initialSeq: -1, seqSelector: (message) => message.seq }),
          tap((message) => {
            logger.log(`[${message.seq}] <== [${message.type}]:`, message);
          }),
          concatMap(({ seq, type, randomValue, description, candidate }) =>
            defer(() => {
              logger.log(`[${seq}] <== [${type}]: executing...`);

              if (type === "SelectingLeader" || type === "ConfirmingLeader") {
                if (!hasKnownPeerConnectionRole) {
                  hasKnownPeerConnectionRole = true;

                  if (localLeaderSelectionRandomValue > randomValue) {
                    isPolite = false;
                  } else {
                    isPolite = true;
                  }
                  setStateIsPolite(isPolite);

                  refPcm.current.createConnection();

                  subscription.add(
                    refPcm.current.tracksSubject.subscribe((event) => {
                      logger.debug("remote stream avaiable", event.streams[0]);
                      logger.debug("remote track avaiable", event.track);

                      if (event.streams != null && event.streams[0] != null) {
                        refVideo.current.srcObject = event.streams[0];
                      } else {
                        if (refVideo.current.srcObject == null) {
                          logger.debug("video doesn't have srcObject");
                          refVideo.current.srcObject = new MediaStream();
                        }
                        refVideo.current.srcObject.addTrack(event.track);
                      }
                    })
                  );

                  logger.debug("subscribing to localIceCandidatesSubject");
                  subscription.add(
                    refPcm.current.localIceCandidatesSubject.subscribe(
                      (candidate) => {
                        logger.debug("local ice candidate available");
                        send({ type: "IceCandidate", candidate });
                      }
                    )
                  );

                  subscription.add(
                    refPcm.current.negotiationNeededSubject
                      .pipe(
                        mergeMap(() => refPcm.current.createOfferObservable())
                      )
                      .subscribe((description) => {
                        logger.debug(
                          "negotiation needed, sending offer",
                          description
                        );
                        send({ type: "Offer", description });
                      })
                  );

                  // Don't send out SelectingLeader if we have already moved to
                  // ConfirmingLeader
                  clearTimeout(timeoutHandler);

                  send({
                    type: "ConfirmingLeader",
                    randomValue: localLeaderSelectionRandomValue,
                  });
                } else {
                  logger.debug(`${type} has no effect`);
                }
              }

              if (type === "ConfirmingLeader") {
                logger.debug("subscribing to localMediaStreamSubject");
                subscription.add(
                  localMediaStreamSubject.subscribe((mediaStream) => {
                    logger.debug("local MediaStream updated", mediaStream);
                    if (mediaStream != null) {
                      mediaStream.getTracks().forEach((track) => {
                        logger.debug("local track", track);
                        refPcm.current.addTrack(track, mediaStream);
                      });
                    }
                  })
                );
              }

              if (type === "Offer" || type === "Answer") {
                logger.log(
                  `received remote description:`,
                  `type = ${type}`,
                  `is polite = ${isPolite}`,
                  `signaling state = ${refPcm.current.getSignalingState()}`
                );

                if (
                  type === "Offer" &&
                  refPcm.current.getSignalingState() !== "stable"
                ) {
                  if (!isPolite) {
                    return EMPTY;
                  }

                  logger.log(
                    "setting remote description and rollback local description"
                  );

                  return refPcm.current
                    .setRemoteDescription(description)
                    .then(() => {
                      if (type === "Offer") {
                        return refPcm.current.createAnswer();
                      }
                    })
                    .then((description) => {
                      if (description != null) {
                        logger.debug("sending answer", description);
                        send({ type: "Answer", description });
                      }
                    });
                } else {
                  logger.log(
                    "setting remote description without rollback local description"
                  );
                  return refPcm.current
                    .setRemoteDescription(description)
                    .then(() => {
                      if (type === "Offer") {
                        return refPcm.current.createAnswer();
                      }
                    })
                    .then((description) => {
                      if (description != null) {
                        logger.debug("sending answer", description);
                        send({ type: "Answer", description });
                      }
                    });
                }
              }

              if (type === "IceCandidate") {
                refPcm.current.addIceCandidate(candidate);
              }

              return EMPTY;
            })
          )
        )
        .subscribe(() => {})
    );

    return () => {
      logger.debug(`useEffect() clean up. clientId = ${clientId}`);
      clearTimeout(timeoutHandler);
      subscription.unsubscribe();
    };
  }, [
    clientId,
    localMediaStreamSubject,
    send,
    logger,
    localLeaderSelectionRandomValue,
  ]);

  return (
    <div className={classNames({ "Room_single-video-container": true })}>
      <div>
        <code>
          (REMOTE) {`(${stateIsPolite})`} {clientId}
        </code>
      </div>
      <video
        key={clientId}
        ref={refVideo}
        width={320}
        height={240}
        muted={isMuted}
        autoPlay
        playsInline
      />
      <button
        onClick={() => {
          setIsMuted((isMuted) => !isMuted);
        }}
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
