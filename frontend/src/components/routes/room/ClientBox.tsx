import classNames from "classnames";
import { Subject } from "rxjs";

import ClientBoxLocal from "./ClientBoxLocal";
import ClientBoxRemote from "./ClientBoxRemote";

export default function ClientBox({
  clientId,
  localMediaStreamSubject,
  localClientId,
}: {
  clientId: string;
  localMediaStreamSubject: Subject<MediaStream | null>;
  localClientId: string | null;
}) {
  const isLocal = localClientId != null && clientId === localClientId;
  const isRemote = localClientId != null && clientId !== localClientId;

  if (isLocal) {
    return (
      <ClientBoxLocal
        key={clientId}
        clientId={clientId}
        localMediaStreamSubject={localMediaStreamSubject}
      />
    );
  } else if (isRemote) {
    return (
      <ClientBoxRemote
        key={clientId}
        clientId={clientId}
        localMediaStreamSubject={localMediaStreamSubject}
      />
    );
  } else {
    return (
      <div
        className={classNames({
          "Room_single-video-container": true,
        })}
      >
        <div>
          <code>(UNKNOWN) {clientId}</code>
        </div>
      </div>
    );
  }
}
