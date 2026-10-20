import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { multiHarness } from '../test/multi-harness';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import { exchangeFirebaseSession } from '../../../src/server/auth/firebase-service';
import { withAuthTimings, type AuthTiming } from '../../../src/server/auth/performance';
test(
  'sequential synthetic local CPU and D1 comparison; never hosted qualification',
  { skip: !process.env.DD_CPU_BASELINE_SRC, timeout: 120000 },
  async () => {
    const baseline = await import(
      pathToFileURL(process.env.DD_CPU_BASELINE_SRC + '/src/server/auth/firebase-service.ts').href
    );
    const old = (baseline.default ?? baseline).exchangeFirebaseSession;
    const h = await multiHarness(),
      original = globalThis.fetch,
      pair = await generateKeyPair('RS256'),
      jwk = { ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' },
      now = Math.floor(Date.now() / 1000),
      project = 'synthetic-cpu-fixture';
    const cpu = () => {
      const x = process.cpuUsage();
      return (x.user + x.system) / 1000;
    };
    let keys = 0,
      lookups = 0;
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      if (String(input).startsWith('https://www.googleapis.com/')) {
        keys++;
        return Response.json({ keys: [jwk] });
      }
      assert(
        String(input).startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup?'),
      );
      lookups++;
      const payload = JSON.parse(
        Buffer.from(JSON.parse(String(init?.body)).idToken.split('.')[1], 'base64url').toString(),
      );
      return Response.json({ users: [{ localId: payload.sub, validSince: String(now - 60) }] });
    }) as typeof fetch;
    await h.db.D1_USERS.prepare(
      'INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)',
    ).run();
    const rows: any[] = [];
    try {
      for (const [variant, exchange] of [
        ['baseline', old],
        ['optimized', exchangeFirebaseSession],
      ] as const) {
        let previous: string | undefined;
        for (const [operation, uid, mobile] of [
          ['cold-web', variant + '-a', false],
          ['warm-web-refresh', variant + '-a', false],
          ['native', variant + '-b', true],
        ] as const) {
          const token = await new SignJWT({
            auth_time: now - 10,
            email: uid + '@example.invalid',
            email_verified: true,
          })
            .setSubject(uid)
            .setAudience(project)
            .setIssuer('https://securetoken.google.com/' + project)
            .setIssuedAt(now)
            .setExpirationTime(now + 3600)
            .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
            .sign(pair.privateKey);
          const router = new MultiD1(h.db),
            timings: AuthTiming[] = [];
          const start = cpu();
          const session = await withApplicationBindings(
            {
              db: h.db.D1_USERS,
              multiD1: router,
              objects: router.users().objects,
              env: {
                APP_DATA_BACKEND: 'd1',
                AUTH_PROVIDER: 'firebase',
                FIREBASE_AUTH_ENABLED: 'true',
                FIREBASE_PROJECT_ID: project,
                FIREBASE_AUTH_DOMAIN: project + '.firebaseapp.com',
                FIREBASE_API_KEY: 'synthetic-key',
                FIREBASE_APP_ID: 'synthetic-app',
                AUTH_JWT_SECRET: 'synthetic-cpu-secret-at-least-32-characters-only',
              },
            },
            () =>
              withAuthTimings(
                timings,
                () => exchange(token, mobile ? undefined : previous, { mobile }),
                cpu,
              ),
          );
          const localNodeCpuMs = cpu() - start;
          if (!mobile) previous = session.refreshToken;
          assert(session.user.id);
          if (variant === 'optimized') assert.equal(Boolean(session.accessToken), mobile);
          rows.push({
            variant,
            operation,
            localNodeCpuMs,
            d1: { ...router.metrics },
            stages: timings,
          });
        }
      }
      for (const operation of ['cold-web', 'warm-web-refresh', 'native']) {
        const before = rows.find((r) => r.variant === 'baseline' && r.operation === operation);
        const after = rows.find((r) => r.variant === 'optimized' && r.operation === operation);
        assert(after.d1.statements < before.d1.statements);
      }
      await writeFile(
        '../../reports/firebase-cpu/local-comparison.json',
        JSON.stringify(
          {
            source:
              'Local Node process.cpuUsage, sequential fixture requests; includes Node orchestration and crypto threads, excludes D1 workerd subprocess CPU; NOT hosted or Worker CPU',
            baselineCommit: '75e6910d',
            keyFetches: keys,
            providerLookups: lookups,
            rows,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      globalThis.fetch = original;
      await h.close();
    }
  },
);
