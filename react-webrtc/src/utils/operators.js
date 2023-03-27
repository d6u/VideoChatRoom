import {
  BehaviorSubject,
  EMPTY,
  from,
  map,
  mergeMap,
  Observable,
  Subscription,
  tap,
  withLatestFrom,
} from "rxjs";
import { List } from "immutable";
import Logger from "./Logger";

export function sort({ initialSeq, seqSelector }) {
  return (observable) => {
    return new Observable((subscriber) => {
      const logger = new Logger("sort() operator");
      const subscription = new Subscription();

      const messagesListSubject = new BehaviorSubject(List());
      let prevSeq = initialSeq;

      subscription.add(
        observable.subscribe((message) => {
          let list = messagesListSubject.getValue();
          list = list.push(message);
          messagesListSubject.next(list);
        })
      );

      subscription.add(
        observable
          .pipe(
            withLatestFrom(messagesListSubject),
            map(([, list]) =>
              list
                .sortBy(seqSelector)
                .filter((message) => seqSelector(message) > prevSeq)
            ),
            mergeMap((list) => {
              if (list.size === 0) {
                messagesListSubject.next(list);
                return EMPTY;
              }

              let hasTheRightSequence = false;
              if (prevSeq === -1) {
                if (
                  seqSelector(list.get(0)) === 0 ||
                  seqSelector(list.get(0)) === 1
                ) {
                  hasTheRightSequence = true;
                } else {
                  logger.warn(
                    `first message's seq doesn't start with 0 or 1. (prevSeq: ${prevSeq})`,
                    JSON.stringify(list.toJS(), null, 4)
                  );
                }
              } else {
                if (
                  seqSelector(list.get(0)) > 0 &&
                  seqSelector(list.get(0)) === prevSeq + 1
                ) {
                  hasTheRightSequence = true;
                } else {
                  logger.warn(
                    `first message's seq wasn't right after prevSeq ${prevSeq}.`,
                    JSON.stringify(list.toJS(), null, 4)
                  );
                }
              }

              if (!hasTheRightSequence) {
                return EMPTY;
              }

              let prevIndex = 0;

              for (let i = 1; i < list.size; i++) {
                if (
                  seqSelector(list.get(i)) !==
                  seqSelector(list.get(prevIndex)) + 1
                ) {
                  break;
                }
                prevIndex = i;
              }

              messagesListSubject.next(list.slice(prevIndex + 1));
              return from(list.slice(0, prevIndex + 1));
            }),
            tap((message) => {
              prevSeq = seqSelector(message);
            })
          )
          .subscribe(subscriber)
      );

      return () => {
        subscription.unsubscribe();
      };
    });
  };
}
