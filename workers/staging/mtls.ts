/** Cloudflare-populated TLS metadata only. Never accept a forwarded header as proof.
 * Requires an approved, mTLS-enabled staging hostname and individual client certs.
 */
export function mtlsGate(downstream: {
  fetch(request: Request, env: any, ctx: any): Promise<Response>;
}) {
  return {
    async fetch(request: Request, env: any, ctx: any) {
      const host = env.STAGING_MTLS_HOST ?? '';
      const list = (env.STAGING_MTLS_SHA256 ?? '').split(',');
      const tls = (request as Request & { cf?: { tlsClientAuth?: Record<string, string> } }).cf
        ?.tlsClientAuth;
      const valid =
        /^[a-z0-9.-]+$/.test(host) &&
        host.includes('.') &&
        new URL(request.url).protocol === 'https:' &&
        new URL(request.url).hostname === host &&
        list.length > 0 &&
        list.length <= 50 &&
        list.every((x: string) => /^[a-f0-9]{64}$/.test(x)) &&
        tls?.certPresented === '1' &&
        tls.certVerified === 'SUCCESS' &&
        tls.certRevoked === '0' &&
        list.includes(tls.certFingerprintSHA256?.toLowerCase());
      if (!valid)
        return new Response('Staging client certificate required', {
          status: 403,
          headers: {
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        });
      return downstream.fetch(request, env, ctx);
    },
  };
}
