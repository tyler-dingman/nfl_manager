/** Called only after stagingAccessGate authenticates the request. OpenNext expects
 * the platform asset router to handle static files; run_worker_first deliberately
 * routes every request through our gate, so authorized assets need explicit
 * binding dispatch. API requests never probe the asset binding. */
export function authorizedStagingDispatch(application: {
  fetch(request: Request, env: any, ctx: any): Promise<Response>;
}) {
  return {
    async fetch(request: Request, env: any, ctx: any) {
      const path = new URL(request.url).pathname;
      if (['GET', 'HEAD'].includes(request.method) && !path.startsWith('/api/')) {
        if (!env.ASSETS?.fetch)
          return new Response('Private staging is unavailable', { status: 503 });
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
        // Asset misses retain normal application routing; an asset service error
        // is returned directly rather than bypassed by a dynamic fallback.
      }
      return application.fetch(request, env, ctx);
    },
  };
}
