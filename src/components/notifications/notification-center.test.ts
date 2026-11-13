import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('notification connection failures are contained; loading and unread state remain accurate', async () => {
  const previousFetch = globalThis.fetch;
  const harness = { callbacks: [] as Function[], states: [] as any[], updates: [] as any[] };
  (globalThis as any).__notificationHarness = harness;
  const stub = `
    const h = globalThis.__notificationHarness;
    export const useCallback = fn => { h.callbacks.push(fn); return fn; };
    export const useEffect = () => {};
    export const useRef = () => ({current:null});
    export const useState = initial => { const i=h.states.length; h.states.push(initial); return [initial, value=>{h.states[i]=typeof value==='function'?value(h.states[i]):value;h.updates.push([i,h.states[i]]);}]; };
    export const useRouter = () => ({push:()=>{}});
    export const useDraftTradeNotifications = () => ({session:null});
    export const unreadDraftOffers = () => 0;
    export const useAuthUser = () => ({hydrated:true,user:{id:'fixture'}});
    export const notificationMatchesTeamScope = () => true;
    export const lockDocumentScroll = () => () => {};
    export const CircleAlert=()=>null, Flame=CircleAlert,Gamepad2=CircleAlert,ShieldCheck=CircleAlert,Trophy=CircleAlert,Users=CircleAlert,X=CircleAlert;
    export const DdNotificationsIcon=CircleAlert,DdScheduleIcon=CircleAlert,DdArticlesIcon=CircleAlert;
    export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment='fragment';
  `;
  try {
    const result = await build({
      entryPoints: ['src/components/notifications/notification-center.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      plugins: [
        {
          name: 'notification-fixtures',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) =>
              args.kind === 'entry-point' ? undefined : { path: args.path, namespace: 'fixture' },
            );
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents: stub,
              loader: 'js',
            }));
          },
        },
      ],
    });
    const { default: NotificationCenter } = await import(
      'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
    );
    NotificationCenter({ teamAbbr: 'KC' });
    const [refresh, load] = harness.callbacks;
    const countIndex = 3,
      loadingIndex = 5,
      errorIndex = 6;
    harness.states[countIndex] = 7;
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await assert.doesNotReject(() => refresh());
    assert.equal(harness.states[countIndex], 7, 'failed poll must retain last unread count');
    await assert.doesNotReject(() => load());
    assert.equal(harness.states[loadingIndex], false, 'failed load must release spinner');
    assert.match(harness.states[errorIndex], /Unable to load/);
    globalThis.fetch = async () => new Response('unavailable', { status: 503 });
    await load();
    assert.match(harness.states[errorIndex], /Unable to load/);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ notifications: [], nextCursor: null, count: 2 }), {
        headers: { 'content-type': 'application/json' },
      });
    await load();
    await refresh();
    assert.equal(harness.states[errorIndex], '', 'successful retry clears error');
    assert.equal(harness.states[countIndex], 2);
  } finally {
    globalThis.fetch = previousFetch;
    delete (globalThis as any).__notificationHarness;
  }
});
