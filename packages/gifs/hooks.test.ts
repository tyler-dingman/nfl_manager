import test from 'node:test';
import assert from 'node:assert/strict';
import { createUseHuddle, type Hooks } from '../huddle/use-huddle';
import { createUseGifPicker } from './use-picker';
import type { GifProvider, GifItem } from './index';
// Minimal deterministic hook scheduler: exercises the shared state logic without network/native dependencies.
function harness() {
  const slots: any[] = [];
  let index = 0;
  const pending: Array<() => void> = [];
  const hooks: Hooks = {
    useState(initial: any) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[i],
        (v: any) => {
          slots[i] = typeof v === 'function' ? v(slots[i]) : v;
        },
      ];
    },
    useRef(initial: any) {
      const i = index++;
      return slots[i] ?? (slots[i] = { current: initial });
    },
    useCallback(fn: any) {
      index++;
      return fn;
    },
    useEffect(effect, deps) {
      const i = index++;
      const prev = slots[i];
      if (!prev || deps.some((x, n) => x !== prev.deps[n])) {
        pending.push(() => {
          prev?.cleanup?.();
          slots[i] = { deps, cleanup: effect() };
        });
      }
    },
  };
  return {
    hooks,
    render<T>(f: () => T) {
      index = 0;
      const value = f();
      while (pending.length) pending.shift()!();
      return value;
    },
    dispose() {
      for (const s of slots) s?.cleanup?.();
    },
  };
}
const gif: GifItem = {
  id: 'football',
  provider: 'klipy',
  title: 'Football',
  previewUrl: 'https://static.klipy.com/test/tiny.gif',
  stillUrl: 'https://static.klipy.com/test/still.jpg',
  mediaUrl: 'https://static.klipy.com/test/small.gif',
  width: 220,
  height: 124,
  aspectRatio: 220 / 124,
  providerUrl: 'https://klipy.com/gifs/football',
  attribution: 'Powered by KLIPY',
};
const media = { mediaType: 'gif', provider: 'klipy', providerMediaId: 'football' } as const;
test('GIF-only and text+GIF append locally, react, reply, mute and preserve archive read-only', async () => {
  const old = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'development' });
  try {
    for (const query of ['team=KC', 'team=PHI&mode=gameday']) {
      const h = harness(),
        use = createUseHuddle(h.hooks);
      let result = h.render(() => use(query));
      result = h.render(() => use(query));
      const count = result.data!.messages.length;
      assert.equal(
        await result.act({
          action: 'message',
          body: '',
          media,
          resolvedGif: gif,
          clientId: 'gif-one',
          name: 'Tester',
        }),
        true,
      );
      result = h.render(() => use(query));
      assert.equal(result.data!.messages.length, count + 1);
      assert.equal(result.data!.messages.at(-1)?.media?.providerMediaId, 'football');
      assert.equal(
        await result.act({
          action: 'message',
          body: 'LET’S GO',
          media,
          resolvedGif: gif,
          clientId: 'gif-two',
          replyTo: 'gif-one',
        }),
        true,
      );
      result = h.render(() => use(query));
      assert.equal(result.data!.messages.at(-1)?.replyTo, 'gif-one');
      await result.act({ action: 'like', id: 'gif-one', enabled: true });
      result = h.render(() => use(query));
      assert.equal(result.data!.messages.find((m) => m.id === 'gif-one')?.likes, 1);
      await result.act({ action: 'like', id: 'gif-one', enabled: false });
      result = h.render(() => use(query));
      assert.equal(result.data!.messages.find((m) => m.id === 'gif-one')?.likes, 0);
      await result.act({ action: 'mute', userId: 'preview-self' });
      result = h.render(() => use(query));
      assert.ok(result.data!.hiddenUsers.includes('preview-self'));
      h.dispose();
    }
    const h = harness(),
      use = createUseHuddle(h.hooks);
    let result = h.render(() => use('team=KC&archive=1&date=2026-09-27'));
    result = h.render(() => use('team=KC&archive=1&date=2026-09-27'));
    assert.equal(await result.act({ action: 'message', body: '', media }), false);
    h.dispose();
  } finally {
    Object.assign(process.env, { NODE_ENV: old });
  }
});
test('picker debounces for 300ms and ignores stale responses', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls: string[] = [];
  const resolve: Record<string, (v: any) => void> = {};
  const provider: GifProvider = {
    search: (q) => {
      calls.push(q);
      return new Promise((r) => (resolve[q] = r));
    },
    trending: async () => ({ items: [gif] }),
    getById: async () => gif,
    share: async () => {},
  };
  const h = harness(),
    use = createUseGifPicker(h.hooks);
  let p = h.render(() => use(provider));
  t.mock.timers.tick(1);
  await Promise.resolve();
  p = h.render(() => use(provider));
  assert.equal(p.items.length, 1);
  p.setQuery('ch');
  p = h.render(() => use(provider));
  t.mock.timers.tick(200);
  assert.equal(calls.length, 0);
  p.setQuery('chiefs');
  p = h.render(() => use(provider));
  t.mock.timers.tick(299);
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(calls, ['chiefs']);
  p.setQuery('football');
  p = h.render(() => use(provider));
  t.mock.timers.tick(300);
  resolve.football({ items: [{ ...gif, id: 'new' }] });
  await Promise.resolve();
  p = h.render(() => use(provider));
  assert.equal(p.items[0].id, 'new');
  resolve.chiefs({ items: [{ ...gif, id: 'stale' }] });
  await Promise.resolve();
  p = h.render(() => use(provider));
  assert.equal(p.items[0].id, 'new');
  h.dispose();
});
