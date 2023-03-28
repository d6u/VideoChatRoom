import { List } from "immutable";
import {
  EMPTY,
  Observable,
  Subscription,
  first,
  from,
  map,
  mergeMap,
  of,
  share,
  tap,
} from "rxjs";

import Logger from "./Logger";

export function sort({
  initialSeq,
  getPrevSeqObservable,
  seqSelector,
  notifySequenceGap,
}) {
  if (initialSeq != null && getPrevSeqObservable != null) {
    throw new Error("initialSeq and prevSeqObservable cannot be set together.");
  }

  return (observable) => {
    return new Observable((subscriber) => {
      const logger = new Logger("sort() operator");
      const subscription = new Subscription();

      let messagesList = List();
      let prevSeq = initialSeq ?? -1;

      const sharedObservable = observable.pipe(share());

      subscription.add(
        sharedObservable.subscribe((message) => {
          messagesList = messagesList.push(message);
        })
      );

      let sortingObservable = sharedObservable;

      if (getPrevSeqObservable != null) {
        sortingObservable = sortingObservable.pipe(
          mergeMap(() => getPrevSeqObservable().pipe(first()))
        );
      } else {
        sortingObservable = sortingObservable.pipe(mergeMap(() => of(null)));
      }

      subscription.add(
        sortingObservable
          .pipe(
            map((prevData) => [
              messagesList
                .sortBy(seqSelector)
                .filter(
                  (message) => seqSelector(message) > (prevData ?? prevSeq)
                ),
              prevData ?? prevSeq,
            ]),
            mergeMap(([list, prevSeqLocal]) => {
              if (list.size === 0) {
                messagesList = list;
                return EMPTY;
              }

              let hasTheRightSequence = false;
              if (seqSelector(list.get(0)) === prevSeqLocal + 1) {
                hasTheRightSequence = true;
              } else {
                logger.warn(
                  `first message's seq wasn't right after prevSeq ${prevSeqLocal}.`,
                  JSON.stringify(list.toJS(), null, 4)
                );
              }

              if (!hasTheRightSequence) {
                if (notifySequenceGap != null) {
                  notifySequenceGap(prevSeqLocal, seqSelector(list.get(0)));
                }
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

              messagesList = list.slice(prevIndex + 1);
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
