import { useEffect, useRef, useState } from "react";
import {
  BehaviorSubject,
  defer,
  EMPTY,
  filter,
  from,
  map,
  mergeMap,
  Subscription,
  tap,
  withLatestFrom,
} from "rxjs";
import classNames from "classnames";
import { List } from "immutable";
import Logger from "../../utils/Logger";
import webSocketManager from "../../utils/WebSocketManager";
import PeerConnectionManager from "../../utils/PeerConnectionManager";

function filterDirectMessage(clientId) {
  return function (data) {
    return (
      !data.isDelta &&
      data.type === "DirectMessage" &&
      data.fromClientId === clientId
    );
  };
}

function useLogger(label) {
  const logger = useRef(null);
  if (logger.current == null) {
    logger.current = new Logger(label);
  }
  return logger.current;
}

export default function ClientBoxRemote({ clientId, localMediaStreamSubject }) {
  const logger = useLogger(`ClientBoxRemote(${clientId})`);
  const refSeq = useRef(0);
  const refRandomValue = useRef(null);
  const refVideo = useRef(null);
  const refPcm = useRef(null);

  if (refRandomValue.current == null) {
    refRandomValue.current = Math.floor(Math.random() * (Math.pow(2, 31) - 1));
  }

  const [stateIsPolite, setStateIsPolite] = useState(null);

  useEffect(() => {
    refPcm.current = new PeerConnectionManager();

    return () => {
      refPcm.current.destroy();
    };
  }, [clientId]);

  useEffect(() => {
    logger.debug(`useEffect() setup. clientId = ${clientId}`);

    const subscription = new Subscription();

    const remoteMessageListsSubject = new BehaviorSubject(List());
    let prevSeq = -1;
    let hasKnownPeerConnectionRole = false;
    let isPolite = false;

    function send(message) {
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
    }

    // Defer executing to avoid immediate clean up in useEffect()
    const timeoutHandler = setTimeout(() => {
      send({
        type: "SelectingLeader",
        randomValue: refRandomValue.current,
      });
    }, 200);

    const remoteMessagesObservable = webSocketManager.messagesSubject.pipe(
      filter(filterDirectMessage(clientId)),
      map((data) => data.message)
    );

    subscription.add(
      remoteMessagesObservable.subscribe((message) => {
        remoteMessageListsSubject.next(
          remoteMessageListsSubject.getValue().push(message)
        );
      })
    );

    subscription.add(
      remoteMessagesObservable
        .pipe(
          withLatestFrom(remoteMessageListsSubject),
          map(([, messages]) =>
            messages.sortBy((m) => m.seq).filter((m) => m.seq > prevSeq)
          ),
          mergeMap((messages) => {
            let hasTheRightSequence = false;
            if (prevSeq === -1) {
              if (messages.get(0).seq === 0 || messages.get(0).seq === 1) {
                hasTheRightSequence = true;
              } else {
                logger.warn(
                  `first message's seq doesn't start with 0 or 1. (prevSeq: ${prevSeq})`,
                  JSON.stringify(messages.toJS(), null, 4)
                );
              }
            } else {
              if (
                messages.get(0).seq > 0 &&
                messages.get(0).seq === prevSeq + 1
              ) {
                hasTheRightSequence = true;
              } else {
                logger.warn(
                  `first message's seq wasn't right after prevSeq ${prevSeq}.`,
                  JSON.stringify(messages.toJS(), null, 4)
                );
              }
            }

            if (!hasTheRightSequence) {
              return EMPTY;
            }

            let prevIndex = 0;

            for (let i = 1; i < messages.size; i++) {
              if (messages.get(i).seq !== messages.get(prevIndex).seq + 1) {
                break;
              }
              prevIndex = i;
            }

            remoteMessageListsSubject.next(messages.slice(prevIndex + 1));
            return from(messages.slice(0, prevIndex + 1));
          }),
          tap((message) => {
            logger.log(`[${message.seq}] <== [${message.type}]:`, message);
          })
        )
        .subscribe(({ seq, type, randomValue, description, candidate }) => {
          prevSeq = seq;

          if (type === "SelectingLeader" || type === "ConfirmingLeader") {
            if (!hasKnownPeerConnectionRole) {
              hasKnownPeerConnectionRole = true;

              if (refRandomValue.current > randomValue) {
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
                  .pipe(mergeMap(() => refPcm.current.createOfferObservable()))
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
                randomValue: refRandomValue.current,
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
            defer(() => {
              logger.debug(
                `received remote description:`,
                `type = ${type}`,
                `is polite = ${isPolite}`
              );
              if (
                type === "Offer" &&
                refPcm.current.getSignalingState() !== "stable"
              ) {
                if (!isPolite) {
                  return EMPTY;
                }

                logger.debug(
                  "setting remote description and rollback local description"
                );

                return from(refPcm.current.setRemoteDescription(description));
              } else {
                logger.debug(
                  "setting remote description without rollback local description"
                );
                return from(refPcm.current.setRemoteDescription(description));
              }
            })
              .pipe(
                mergeMap(() => {
                  if (type === "Offer") {
                    return refPcm.current.createAnswerObservable();
                  }

                  return EMPTY;
                })
              )
              .subscribe((description) => {
                logger.debug("sending answer", description);
                send({ type: "Answer", description });
              });
          }

          if (type === "IceCandidate") {
            refPcm.current.addIceCandidate(candidate);
          }
        })
    );

    return () => {
      logger.debug(`useEffect() clean up. clientId = ${clientId}`);
      clearTimeout(timeoutHandler);
      subscription.unsubscribe();
    };
  }, [clientId, localMediaStreamSubject]);

  return (
    <div className={classNames({ "Room_single-video-container": true })}>
      <div>
        <code>
          (REMOTE) {`(${stateIsPolite})`} {clientId}
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
