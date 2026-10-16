import { type Env } from './bindings';
import { createLocalRepository } from './worker-repository';
// No public content routes, cron, Queue, external fetches, or production integrations.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      createLocalRepository(env);
    } catch {
      return new Response('Local bindings unavailable', { status: 503 });
    }
    const url = new URL(request.url);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      return new Response('Local proof of concept only', { status: 403 });
    return new Response('Editorial D1 local proof of concept; no content HTTP API.', {
      status: 404,
    });
  },
} satisfies ExportedHandler<Env>;
