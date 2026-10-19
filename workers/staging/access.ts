import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
type Environment = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string };
const resolvers = new Map<string, JWTVerifyGetKey>();
/** Verify Access's signed assertion before any application/API/asset dispatch.
 * Identity headers alone are untrusted. Missing configuration always denies. */
export function accessGate(
  downstream: { fetch(request: Request, env: any, ctx: any): Promise<Response> },
  resolveKey?: JWTVerifyGetKey,
) {
  return {
    async fetch(request: Request, env: Environment, ctx: any): Promise<Response> {
      const domain = env.ACCESS_TEAM_DOMAIN ?? '',
        audience = env.ACCESS_AUD ?? '';
      const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
      const deny = () =>
        new Response('Staging access required', {
          status: 403,
          headers: {
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        });
      if (
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(domain) ||
        !/^[a-f0-9]{64}$/.test(audience) ||
        !assertion ||
        assertion.length > 16384
      )
        return deny();
      try {
        let key = resolveKey ?? resolvers.get(domain);
        if (!key) {
          key = createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`), {
            timeoutDuration: 3000,
            cacheMaxAge: 300000,
          });
          // Bound resolver state even if reused by different local configurations.
          if (resolvers.size >= 4) resolvers.delete(resolvers.keys().next().value!);
          resolvers.set(domain, key);
        }
        const { payload } = await jwtVerify(assertion, key, {
          issuer: `https://${domain}`,
          audience,
          algorithms: ['RS256'],
          requiredClaims: ['exp', 'iat', 'sub'],
          clockTolerance: 5,
        });
        if (payload.type !== 'app') return deny();
      } catch {
        return deny();
      }
      const response = await downstream.fetch(request, env, ctx);
      const reply = new Response(response.body, response);
      reply.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      const hashedAsset =
        response.status === 200 &&
        new URL(request.url).pathname.startsWith('/_next/static/') &&
        !response.headers.has('set-cookie') &&
        !/no-store/i.test(response.headers.get('cache-control') ?? '');
      reply.headers.set(
        'Cache-Control',
        hashedAsset ? 'private, max-age=300, immutable' : 'private, no-store',
      );
      return reply;
    },
  };
}
