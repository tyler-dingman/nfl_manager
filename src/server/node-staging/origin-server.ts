import { createServer, IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { SqlDatabase } from '../../../packages/storage/core';
import { MultiD1, type DatabaseOwner } from '../../../packages/storage/multi-d1';
import { withApplicationBindings } from '../persistence/bindings';
import {
  ORIGIN_HEADER,
  verifyOriginRequest,
  type OriginConfiguration,
} from '../../../packages/security/origin-assertion';
import { claimOriginNonce } from './replay';
export type OriginOptions = {
  configuration: OriginConfiguration;
  bindings: Record<DatabaseOwner, SqlDatabase>;
  env: Record<string, string | undefined>;
  api: { fetch(r: Request, e: any): Promise<Response> };
  next: (r: IncomingMessage, s: ServerResponse) => Promise<unknown>;
};
const denied = (res: ServerResponse, status: number) => {
  res.writeHead(status, {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/plain',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  res.end(status === 403 ? 'Private staging origin' : 'Staging temporarily unavailable');
};
export function createNodeOrigin(options: OriginOptions) {
  if (options.configuration.secret === options.env.AUTH_JWT_SECRET)
    throw Error('Origin and application secrets must be independent');
  return createServer({ maxHeaderSize: 20000, requestTimeout: 30000 }, async (req, res) => {
    let verified: Request;
    try {
      // Never read an unauthenticated large body or trust Host/Forwarded/user headers.
      if (typeof req.headers[ORIGIN_HEADER] !== 'string') {
        denied(res, 403);
        return;
      }
      const url = 'http://127.0.0.1' + req.url;
      const source = new Request(url, {
        method: req.method,
        headers: { [ORIGIN_HEADER]: String(req.headers[ORIGIN_HEADER]) },
        ...(!['GET', 'HEAD'].includes(req.method ?? 'GET')
          ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' }
          : {}),
      } as RequestInit);
      verified = await verifyOriginRequest(source, options.configuration, (nonce, expires) =>
        claimOriginNonce(options.bindings.D1_USERS, nonce, expires),
      );
    } catch (error) {
      denied(
        res,
        (error as Error).name === 'RestAtomicityUnverified' ||
          (error as Error).name === 'D1RestError'
          ? 503
          : 403,
      );
      return;
    }
    try {
      const multiD1 = new MultiD1(options.bindings);
      await withApplicationBindings(
        {
          db: multiD1.users().db,
          multiD1,
          objects: multiD1.users().objects,
          env: { ...options.env, APP_RUNTIME: 'node', APP_DATA_BACKEND: 'd1' },
        },
        async () => {
          const publicUrl = new URL(verified.url);
          if (publicUrl.pathname.startsWith('/api/')) {
            const reply = await options.api.fetch(verified, {
              ...options.env,
              ...options.bindings,
              APP_RUNTIME: 'node',
            });
            res.statusCode = reply.status;
            for (const [k, v] of reply.headers) if (k !== 'set-cookie') res.setHeader(k, v);
            const cookies = reply.headers.getSetCookie();
            if (cookies.length) res.setHeader('set-cookie', cookies);
            res.end(Buffer.from(await reply.arrayBuffer()));
            return;
          }
          const nextReq = new IncomingMessage(req.socket);
          nextReq.method = verified.method;
          nextReq.url = publicUrl.pathname + publicUrl.search;
          nextReq.httpVersion = req.httpVersion;
          nextReq.headers = Object.fromEntries(verified.headers);
          nextReq.headers.host = publicUrl.host;
          nextReq.headers['x-forwarded-host'] = publicUrl.host;
          nextReq.headers['x-forwarded-proto'] = 'https';
          nextReq.rawHeaders = Object.entries(nextReq.headers).flatMap(([k, v]) => [k, String(v)]);
          if (verified.body) nextReq.push(Buffer.from(await verified.arrayBuffer()));
          nextReq.push(null);
          res.setHeader('Cache-Control', 'private, no-store');
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
          await options.next(nextReq, res);
        },
      );
    } catch {
      if (!res.headersSent) denied(res, 503);
      else res.destroy();
    }
  });
}
