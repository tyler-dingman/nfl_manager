import test from 'node:test';
import assert from 'node:assert/strict';
import { progressiveSnapshot } from './progressive-snapshot';
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('cold readers coalesce and receive first progress without waiting for completion', async () => {
  let publish!: (value: number) => void,
    finish!: (value: number) => void,
    calls = 0;
  const read = progressiveSnapshot<number>(async (emit) => {
    calls++;
    publish = emit;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const a = read(),
    b = read();
  await tick();
  assert.equal(calls, 1);
  publish(1);
  assert.equal(await a, 1);
  assert.equal(await b, 1);
  publish(2);
  assert.equal(await read(), 2);
  finish(3);
  await tick();
  assert.equal(await read(), 3);
});
test('refresh keeps complete results; hard expiry permits progress and failure is bounded', async () => {
  let clock = 0,
    publish!: (v: number) => void,
    finish!: (v: number) => void,
    fail!: (e: Error) => void;
  const read = progressiveSnapshot<number>(
    async (emit) => {
      publish = emit;
      return new Promise((yes, no) => {
        finish = yes;
        fail = no;
      });
    },
    { freshMs: 10, maxAgeMs: 20, now: () => clock },
  );
  const cold = read();
  await tick();
  finish(1);
  assert.equal(await cold, 1);
  clock = 11;
  assert.equal(await read(), 1);
  await tick();
  publish(2);
  assert.equal(await read(), 1);
  clock = 21;
  const expired = read();
  publish(3);
  assert.equal(await expired, 3);
  fail(new Error('offline'));
  await tick();
  await assert.rejects(read(), /offline/);
});
