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

export function sort<T>({
  initialSeq,
  getPrevSeqObservable,
  seqSelector,
  notifySequenceGap,
}: {
  initialSeq?: number;
  getPrevSeqObservable?: () => Observable<number>;
  seqSelector: (message: any) => number;
  notifySequenceGap?: ({
    fromSeq,
    toSeq,
    messages,
  }: {
    fromSeq: number;
    toSeq: number;
    messages: List<any>;
  }) => void;
}) {
  if (initialSeq != null && getPrevSeqObservable != null) {
    throw new Error("initialSeq and prevSeqObservable cannot be set together.");
  }

  return (observable: Observable<T>) =>
    new Observable<T>((subscriber) => {
      const subscription = new Subscription();

      let messagesList: List<T> = List();
      let prevSeq = initialSeq ?? -1;

      const sharedObservable = observable.pipe(share());

      subscription.add(
        sharedObservable.subscribe((message) => {
          messagesList = messagesList.push(message);
        })
      );

      let sortingObservable: Observable<number | null>;

      if (getPrevSeqObservable != null) {
        sortingObservable = sharedObservable.pipe(
          mergeMap(() => getPrevSeqObservable().pipe(first()))
        );
      } else {
        sortingObservable = sharedObservable.pipe(mergeMap(() => of(null)));
      }

      subscription.add(
        sortingObservable
          .pipe(
            map<number | null, [List<T>, number]>((prevData) => [
              messagesList
                .sortBy(seqSelector)
                .filter(
                  (message) => seqSelector(message) > (prevData ?? prevSeq)
                ),
              prevData ?? prevSeq,
            ]),
            mergeMap(([list, prevSeqLocal]) => {
              messagesList = list;

              if (list.size === 0) {
                return EMPTY;
              }

              if (seqSelector(list.get(0)) > prevSeqLocal + 1) {
                if (notifySequenceGap != null) {
                  notifySequenceGap({
                    fromSeq: prevSeqLocal,
                    toSeq: seqSelector(list.get(0)),
                    messages: list,
                  });
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
}
