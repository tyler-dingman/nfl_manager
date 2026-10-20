import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
const rows = [];
for (const mode of ['tiny-inspector', 'api-inspector', 'api-normal']) {
  const dir = await mkdtemp('/private/tmp/dd-inspect-');
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      ...(mode.endsWith('inspector') ? { inspectorPort: 0 } : {}),
      resourcePersistencePath: dir,
      telemetry: { enabled: false },
      workers: [
        {
          name: 'api',
          modules: true,
          compatibilityDate: '2026-10-18',
          compatibilityFlags: ['nodejs_compat'],
          ...(mode.startsWith('tiny')
            ? { script: 'export default {fetch(){return new Response("ok")}}' }
            : { scriptPath: process.cwd() + '/workers/api/dist/worker.mjs' }),
          d1Databases: Object.fromEntries(
            [
              ...Array.from({ length: 8 }, (_, i) => 'D1_TEAM_' + (i + 1)),
              'D1_USERS',
              'D1_SHARED',
            ].map((x) => [x, 'fixture-' + x]),
          ),
          bindings: {
            APP_MULTI_D1: 'true',
            AUTH_PROVIDER: 'firebase',
            FIREBASE_AUTH_ENABLED: 'true',
          },
          outboundService: () => new Response('No remote requests', { status: 403 }),
        },
      ],
    }),
  );
  try {
    await mf.ready;
    if (mode.endsWith('inspector')) {
      const u = await mf.getInspectorURL();
      u.protocol = 'http:';
      u.pathname = '/json/list';
      console.log(
        'Debugger targets: ' + (await (await fetch(u)).json()).map((t) => t.id).join(', '),
      );
    }
    rows.push({
      mode,
      started: true,
      ...(mode.endsWith('inspector')
        ? { inspectorOrigin: (await mf.getInspectorURL()).origin }
        : {}),
    });
  } catch (e) {
    rows.push({
      mode,
      started: false,
      errorType: e.name,
      errorCode: e.code,
      errorMessage: e.message,
    });
  } finally {
    await mf.dispose();
    await rm(dir, { recursive: true, force: true });
  }
  console.log(mode + ': ' + rows.at(-1).started);
}
await writeFile(
  'reports/firebase-cpu-root-cause/inspector-probe.json',
  JSON.stringify(rows, null, 2) + '\n',
);
