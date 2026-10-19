import { publicCacheKey, cachePublicResponse } from '../web/public-cache';
import { NextRequest } from 'next/server';
import { routes } from './routes.generated';
import { middleware } from '../../src/middleware';
import { withApplicationBindings } from '../../src/server/persistence/bindings';
import { StorageMaintenanceError } from '../../packages/storage/write-fence';
import { StorageCapacityError } from '../../packages/storage/d1-objects';
import { applicationObjects } from '../../packages/storage/d1-objects';
import {
  instrumentDatabase,
  requestMetrics,
  routeFamily,
} from '../../packages/storage/instrumentation';
export default {
  async fetch(request: Request, env: any, ctx?: { waitUntil(p: Promise<unknown>): void }) {
    const metrics = requestMetrics(),
      objects = applicationObjects({ ...env, APP_DB: instrumentDatabase(env.APP_DB, metrics) }),
      start = performance.now();
    return withApplicationBindings(
      {
        db: instrumentDatabase(env.APP_DB, metrics),
        objects,
        ai: env.AI,
        password: env.PASSWORD_SERVICE,
        env: { ...env, APP_RUNTIME: 'cloudflare' },
        cacheNamespace: 'api:' + String(env.APP_CACHE_VERSION ?? 'default'),
      },
      async () => {
        const req = new NextRequest(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: request.signal,
        });
        try {
          const gate = await middleware(req);
          if (!gate.headers.has('x-middleware-next')) return gate;
          const cacheKey =
            env.APP_PUBLIC_CACHE_ENABLED === 'true' &&
            !gate.headers.has('set-cookie') &&
            !gate.headers.has('vary')
              ? publicCacheKey(request, env.APP_CACHE_VERSION ?? '')
              : null;
          const edgeCache = cacheKey ? (caches as unknown as { default: Cache }).default : null;
          if (cacheKey && edgeCache) {
            const hit = await edgeCache.match(cacheKey);
            if (hit) {
              const reply = new Response(hit.body, hit);
              reply.headers.set('X-Application-Cache', 'HIT');
              console.log(
                JSON.stringify({
                  metric: 'application_headers',
                  route: routeFamily(req.nextUrl.pathname),
                  status: reply.status,
                  wallMs: performance.now() - start,
                  ...metrics,
                  r2Reads: 0,
                  r2Writes: 0,
                  cache: 'HIT',
                  cpuMs: null,
                }),
              );
              return reply;
            }
          }
          const route = routes.find((r) => r.pattern.test(req.nextUrl.pathname));
          if (!route) return new Response('Not found', { status: 404 });
          const matches = route.pattern.exec(req.nextUrl.pathname)!;
          const handlers = route.handlers as Record<string, any>;
          const method = request.method === 'HEAD' && !handlers.HEAD ? 'GET' : request.method;
          const allowed = new Set(
            Object.keys(handlers).filter((k) =>
              /^(GET|HEAD|POST|PUT|DELETE|PATCH|OPTIONS)$/.test(k),
            ),
          );
          if (allowed.has('GET')) allowed.add('HEAD');
          allowed.add('OPTIONS');
          if (method === 'OPTIONS' && !handlers.OPTIONS)
            return new Response(null, { status: 204, headers: { Allow: [...allowed].join(', ') } });
          if (!handlers[method])
            return new Response(null, { status: 405, headers: { Allow: [...allowed].join(', ') } });
          let response: Response;
          try {
            const params = Object.fromEntries(
              route.names.map((name, i) => [name, decodeURIComponent(matches[i + 1])]),
            );
            response = await handlers[method](req, { params: Promise.resolve(params) });
          } catch (error) {
            console.error(
              JSON.stringify({
                metric: 'api_failure',
                route: routeFamily(req.nextUrl.pathname),
                error: error instanceof Error ? error.name : 'Error',
              }),
            );
            response =
              error instanceof StorageMaintenanceError || error instanceof StorageCapacityError
                ? Response.json(
                    { error: 'Storage temporarily unavailable. Retry later.' },
                    { status: 503, headers: { 'Retry-After': '60' } },
                  )
                : Response.json({ error: 'Internal server error' }, { status: 500 });
          }
          const result = new Response(request.method === 'HEAD' ? null : response.body, response);
          for (const [name, value] of gate.headers)
            if (!name.startsWith('x-middleware-')) result.headers.set(name, value);
          if (
            cacheKey &&
            edgeCache &&
            !gate.headers.has('set-cookie') &&
            result.status === 200 &&
            !result.headers.has('set-cookie') &&
            !/private|no-store/i.test(response.headers.get('cache-control') ?? '') &&
            !result.headers.has('vary')
          ) {
            if (!result.headers.has('Cache-Control'))
              result.headers.set('Cache-Control', 'public, max-age=30');
            result.headers.set('X-Application-Cache', 'MISS');
            const put = cachePublicResponse(edgeCache, cacheKey, result).catch(() => false);
            if (ctx) ctx.waitUntil(put);
            else await put;
          } else {
            result.headers.set('Cache-Control', 'private, no-store');
            result.headers.set('X-Application-Cache', 'BYPASS');
          }
          result.headers.set('X-Content-Type-Options', 'nosniff');
          console.log(
            JSON.stringify({
              metric: 'application_headers',
              route: routeFamily(req.nextUrl.pathname),
              status: result.status,
              wallMs: performance.now() - start,
              ...metrics,
              r2Reads: objects.reads,
              r2Writes: objects.writes,
              cpuMs: null,
              cpuSource: 'Cloudflare TraceEvent CPUTimeMs required',
            }),
          );
          return result;
        } finally {
          if (req.body && !req.bodyUsed) {
            const reader = req.body.getReader();
            try {
              while (!(await reader.read()).done) {
                /* Drain rejected requests without retaining payload bytes. */
              }
            } finally {
              reader.releaseLock();
            }
          }
        }
      },
    );
  },
};
