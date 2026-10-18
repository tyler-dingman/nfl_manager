// Built first by OpenNext. This file adds request-scoped bindings and private-cache policy.
// @ts-ignore Generated build artifact; not present before the OpenNext build.
import application from '../../.open-next/worker.js';
import { withApplicationBindings } from '../../src/server/persistence/bindings';
import { PrivateObjects, type Bucket } from '../../packages/storage/objects';
import type { SqlDatabase } from '../../packages/storage/core';
import {
  instrumentDatabase,
  requestMetrics,
  routeFamily,
} from '../../packages/storage/instrumentation';
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const metrics = requestMetrics(),
      objects = new PrivateObjects(env.APP_OBJECTS as Bucket, env.APP_BACKUP as Bucket),
      start = performance.now();
    const response = await withApplicationBindings(
      {
        db: instrumentDatabase(env.APP_DB as SqlDatabase, metrics),
        objects,
        ai: env.AI,
        env: { ...env, APP_RUNTIME: 'cloudflare' },
      },
      () => application.fetch(request, env, ctx),
    );
    console.log(
      JSON.stringify({
        metric: 'application_headers',
        route: routeFamily(new URL(request.url).pathname),
        status: response.status,
        wallMs: performance.now() - start,
        ...metrics,
        r2Reads: objects.reads,
        r2Writes: objects.writes,
        cpuMs: null,
        cpuSource: 'Use Cloudflare TraceEvent CPUTimeMs; wallMs is not CPU',
      }),
    );
    const next = new Response(response.body, response);
    next.headers.set('X-Content-Type-Options', 'nosniff');
    next.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next.headers.set('X-Frame-Options', 'DENY');
    if (
      request.headers.has('cookie') ||
      request.headers.has('authorization') ||
      new URL(request.url).pathname.startsWith('/api/')
    )
      next.headers.set('Cache-Control', 'private, no-store');
    return next;
  },
};
