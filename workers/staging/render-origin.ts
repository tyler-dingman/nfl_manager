import { verifyOriginRequest } from '../../packages/security/origin-assertion';
import { claimOriginNonce } from '../../src/server/node-staging/replay';
import {
  TRANSACTION_PATH,
  transactionConfiguration,
} from '../../packages/security/transaction-boundary';
import { stagingAccessGate } from './credential-access';
import { authorizedStagingDispatch } from './authorized-dispatch';
import { ORIGIN_HEADER, signOriginRequest } from '../../packages/security/origin-assertion';
/** Separate opt-in entrypoint; no existing deployed Worker configuration references it. */
const gatedApplication = stagingAccessGate(
  authorizedStagingDispatch({
    async fetch(request: Request, env: any) {
      try {
        if (env.DD_NODE_ORIGIN_SECRET === env.STAGING_ACCESS_SECRET)
          throw Error('Independent origin secret required');
        const origin = new URL(env.RENDER_STAGING_ORIGIN ?? '');
        if (
          origin.protocol !== 'https:' ||
          !origin.hostname.endsWith('.onrender.com') ||
          origin.username ||
          origin.password ||
          origin.pathname !== '/' ||
          origin.search ||
          origin.hash
        )
          throw Error('Invalid staging origin');
        const signed = await signOriginRequest(request, {
          secret: env.DD_NODE_ORIGIN_SECRET ?? '',
          audience: 'dd-render-staging',
          publicOrigin: 'https://' + env.STAGING_ACCESS_HOST,
        });
        const target = new URL(new URL(request.url).pathname + new URL(request.url).search, origin);
        return await fetch(target, {
          method: request.method,
          headers: { [ORIGIN_HEADER]: signed.assertion },
          ...(!['GET', 'HEAD'].includes(request.method) ? { body: signed.body as BodyInit } : {}),
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        return new Response('Private staging origin unavailable', {
          status: 503,
          headers: { 'Cache-Control': 'private, no-store' },
        });
      }
    },
  }),
);

/** Only this machine-authenticated path precedes the browser gate. A browser gate
 * cookie, public headers, and edge-to-Render assertions confer no DB capability. */
export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (new URL(request.url).pathname !== TRANSACTION_PATH)
      return gatedApplication.fetch(request, env, ctx);
    try {
      if (request.method !== 'POST' || !env.API_SERVICE?.fetch || !env.D1_USERS)
        throw Error('Private binding unavailable');
      const copy = request.clone();
      await verifyOriginRequest(request, transactionConfiguration(env), (nonce, expires) =>
        claimOriginNonce(env.D1_USERS, nonce, expires),
      );
      // Separate invocations retain independent Free query budgets: nonce claim on
      // Web (4 statements), application transaction on private API (up to50).
      return await env.API_SERVICE.fetch(copy);
    } catch {
      return new Response('Private transaction boundary', {
        status: 403,
        headers: { 'cache-control': 'private, no-store' },
      });
    }
  },
};
