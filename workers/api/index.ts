import { NextRequest } from 'next/server';
import { routes } from './routes.generated';
import { middleware } from '../../src/middleware';
import { withApplicationBindings } from '../../src/server/persistence/bindings';
import { PrivateObjects } from '../../packages/storage/objects';
import {
  instrumentDatabase,
  requestMetrics,
  routeFamily,
} from '../../packages/storage/instrumentation';
export default {
  async fetch(request: Request, env: any) {
    const metrics = requestMetrics(),
      objects = new PrivateObjects(env.APP_OBJECTS, env.APP_BACKUP),
      start = performance.now();
    return withApplicationBindings(
      {
        db: instrumentDatabase(env.APP_DB, metrics),
        objects,
        ai: env.AI,
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
            response = Response.json({ error: 'Internal server error' }, { status: 500 });
          }
          const result = new Response(request.method === 'HEAD' ? null : response.body, response);
          for (const [name, value] of gate.headers)
            if (!name.startsWith('x-middleware-')) result.headers.set(name, value);
          result.headers.set('Cache-Control', 'private, no-store');
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
