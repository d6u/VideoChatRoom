import { expect } from "@jest/globals";
import { List } from "immutable";
import { BehaviorSubject, first, map, tap, zipWith } from "rxjs";
import { TestScheduler } from "rxjs/testing";

import { sort } from "../operators";

test("generates the stream correctly 1", () => {
  const testScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

  testScheduler.run((helpers) => {
    const { cold, expectObservable, expectSubscriptions } = helpers;

    const values = {
      a: { seq: 0 },
      b: { seq: 1 },
      c: { seq: 2 },
      d: { seq: 3 },
      e: { seq: 4 },
    };

    const e1 = cold(" cdab----e", values);
    const expected = "--a(bcd)e";
    const e1subs = "  ^--------";

    expectObservable(
      e1.pipe(sort({ initialSeq: -1, seqSelector: (m) => m.seq }))
    ).toBe(expected, values);

    expectSubscriptions(e1.subscriptions).toBe([e1subs]);
  });
});

test("notify sequence gap", () => {
  const testScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

  const notifySequenceGapFn = jest.fn();

  testScheduler.run((helpers) => {
    const { cold, expectObservable, expectSubscriptions } = helpers;

    const values = {
      a: { seq: 0 },
      b: { seq: 1 },
      c: { seq: 2 },
      d: { seq: 3 },
      e: { seq: 4 },
    };

    const e1 = cold(" cdab----e", values);
    const expected = "--a(bcd)e";
    const e1subs = "  ^--------";

    expectObservable(
      e1.pipe(
        sort({
          initialSeq: -1,
          seqSelector: (m) => m.seq,
          notifySequenceGap: notifySequenceGapFn,
        })
      )
    ).toBe(expected, values);

    expectSubscriptions(e1.subscriptions).toBe([e1subs]);
  });

  expect(notifySequenceGapFn).toHaveBeenCalledTimes(2);
  expect(notifySequenceGapFn).toHaveBeenNthCalledWith(1, {
    fromSeq: -1,
    toSeq: 2,
    messages: List([{ seq: 2 }]),
  });
  expect(notifySequenceGapFn).toHaveBeenNthCalledWith(2, {
    fromSeq: -1,
    toSeq: 2,
    messages: List([{ seq: 2 }, { seq: 3 }]),
  });
});

test("generates the stream correctly 2", () => {
  const testScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

  testScheduler.run((helpers) => {
    const { cold, expectObservable, expectSubscriptions } = helpers;

    const values = {
      a: { seq: 0 },
      b: { seq: 1 },
      c: { seq: 2 },
      d: { seq: 3 },
      e: { seq: 4 },
    };

    const e1 = cold(" cdab----e", values);
    const expected = "--a(bcd)e";
    const e1subs = "  ^--------";

    const prevSeqObservable = new BehaviorSubject(1);

    prevSeqObservable.next(-1);

    expectObservable(
      e1.pipe(
        sort({
          getPrevSeqObservable: () => prevSeqObservable.pipe(first()),
          seqSelector: (m) => m.seq,
        }),
        tap((m) => {
          prevSeqObservable.next(m.seq);
        })
      )
    ).toBe(expected, values);

    expectSubscriptions(e1.subscriptions).toBe([e1subs]);
  });
});
