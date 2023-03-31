import { Subject, Subscription, concatMap, defer, fromEvent } from "rxjs";

import Logger from "../utils/Logger";

const WEBRTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

type PeerConnectionManagerCommand =
  | {
      type: "HandleRemoteDescription";
      description: RTCSessionDescriptionInit;
    }
  | {
      type: "CreateOffer";
    }
  | {
      type: "AddIceCandidate";
      candidate: RTCIceCandidate;
    };

export default class PeerConnectionManager {
  // public
  localIceCandidatesSubject = new Subject<RTCIceCandidate>();
  tracksSubject = new Subject<RTCTrackEvent>();
  descriptionsSubject = new Subject<RTCSessionDescriptionInit>();

  // private
  subscription = new Subscription();
  remoteIceCandidates: RTCIceCandidate[] = [];
  commandsSubject = new Subject<PeerConnectionManagerCommand>();
  private logger: Logger;
  private pc: RTCPeerConnection | null = null;
  private isPolite: boolean;

  // public

  constructor(isPolite: boolean) {
    this.logger = new Logger(`PeerConnectionManager`);
    this.isPolite = isPolite;
    this.logger.log(`constructor(${this.isPolite})`);
  }

  createConnection() {
    this.logger.log("creating connection");

    this.pc = new RTCPeerConnection(WEBRTC_CONFIG);

    this.subscription.add(
      fromEvent(this.pc, "signalingstatechange").subscribe(() => {
        this.logger.log(`signaling state change: ${this.pc!.signalingState}`);

        if (
          (this.pc!.signalingState === "stable" ||
            this.pc!.signalingState === "have-remote-offer") &&
          this.remoteIceCandidates.length > 0
        ) {
          this.logger.log(`add cached ice candidates`);

          Promise.all(
            this.remoteIceCandidates.map((iceCandidate) =>
              this.pc!.addIceCandidate(new RTCIceCandidate(iceCandidate))
            )
          ).then(() => {
            this.remoteIceCandidates = [];
          });
        }
      })
    );

    this.subscription.add(
      fromEvent(this.pc, "negotiationneeded").subscribe(() => {
        this.logger.log(
          `negotiation needed`,
          `signaling state = ${this.pc!.signalingState}`
        );
        this.addCommand({ type: "CreateOffer" });
      })
    );

    this.subscription.add(
      fromEvent<RTCTrackEvent>(this.pc, "track").subscribe((event) => {
        this.logger.debug(`on track:`, event.streams, event.track);
        this.tracksSubject.next(event);
      })
    );

    this.subscription.add(
      fromEvent<RTCPeerConnectionIceEvent>(this.pc, "icecandidate").subscribe(
        (event) => {
          if (event.candidate != null) {
            this.logger.debug("new local icecandidate");
            this.localIceCandidatesSubject.next(event.candidate);
          }
        }
      )
    );

    this.subscription.add(
      this.commandsSubject
        .pipe(concatMap(this.createCommandHandlerObservable))
        .subscribe()
    );
  }

  destroy() {
    this.logger.log(`destroy()`);
    this.subscription?.unsubscribe();
    this.pc?.close();
    this.pc = null;
  }

  handleRemoteDescription(description: RTCSessionDescriptionInit) {
    this.addCommand({
      type: "HandleRemoteDescription",
      description,
    });
  }

  addIceCandidate(candidate: RTCIceCandidate) {
    this.addCommand({ type: "AddIceCandidate", candidate });
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.logger.log(`adding local track`);
    this.pc!.addTrack(track, stream);
  }

  // private

  addCommand(command: PeerConnectionManagerCommand) {
    this.logger.log(`*** adding command: ${command.type}`);
    this.commandsSubject.next(command);
  }

  createCommandHandlerObservable = (command: PeerConnectionManagerCommand) => {
    return defer(async () => {
      console.group("executing command");
      this.logger.log(`>>> executing command: ${command.type}`, command);

      switch (command.type) {
        case "HandleRemoteDescription": {
          const { description } = command;

          this.logger.log(
            `received remote description:`,
            `type = ${description.type},`,
            `is polite = ${this.isPolite},`,
            `signaling state = ${this.pc!.signalingState}`
          );

          if (
            description.type === "offer" &&
            this.pc!.signalingState !== "stable"
          ) {
            if (!this.isPolite) {
              this.logger.log("received offer but not polite, ignoring");
              break;
            }

            this.logger.log(
              "setting remote description (implicitly rollback local description)"
            );
            await this.setRemoteDescription(description);
          } else {
            this.logger.log(
              "setting remote description (won't rollback local description)"
            );
            await this.setRemoteDescription(description);
          }

          if (description.type === "offer") {
            this.logger.log("creating answer in response to remote offer");
            const answer = await this.createAnswer();
            this.descriptionsSubject.next(answer!);
          }
          break;
        }
        case "CreateOffer": {
          const offer = await this.createOffer();
          this.descriptionsSubject.next(offer!);
          break;
        }
        case "AddIceCandidate":
          await this.addIceCandidateInternal(command.candidate);
          break;
        default:
          break;
      }

      this.logger.log(`<<< finish executing command: ${command.type}`, command);
      console.groupEnd();
    });
  };

  async createOffer() {
    try {
      this.logger.log(`creating offer`);
      const offer = await this.pc!.createOffer();
      this.logger.log(`setting offer as local description`);
      await this.pc!.setLocalDescription(offer);
      return offer;
    } catch (error) {
      this.logger.error(`creating offer error`, error);
    }
  }

  async createAnswer() {
    try {
      this.logger.log(`creating answer`);
      const answer = await this.pc!.createAnswer();
      this.logger.log(`setting answer as local description`);
      await this.pc!.setLocalDescription(answer);
      return answer;
    } catch (error) {
      this.logger.error(`create answer error`, error);
    }
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    // if (description.type === "answer" && this.pc.signalingState === "stable") {
    //   this.logger.warn(
    //     `ignoring set remote description for answer, because signaling is in stable state`
    //   );
    //   return;
    // }

    this.logger.log("setting remote description", `type = ${description.type}`);

    try {
      await this.pc!.setRemoteDescription(
        new RTCSessionDescription(description)
      );
    } catch (error) {
      this.logger.error(
        `setting remote description error`,
        `type = ${description.type}`,
        error
      );
    }
  }

  async addIceCandidateInternal(iceCandidate: RTCIceCandidate) {
    if (
      this.pc!.signalingState !== "stable" &&
      this.pc!.signalingState !== "have-remote-offer"
    ) {
      this.logger.warn(
        `caching ice candidate, because signaling state is not in stable or have-remote-offer state, i.e. remote description is null`
      );
      this.remoteIceCandidates.push(iceCandidate);
      return;
    }

    this.logger.log(`adding ice candidate`);

    try {
      await this.pc!.addIceCandidate(new RTCIceCandidate(iceCandidate));
    } catch (error) {
      this.logger.error(`adding ice candidate error`, error);
    }
  }
}
