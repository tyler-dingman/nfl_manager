import { instrumentDatabase, requestMetrics } from '../../packages/storage/instrumentation';
import { Storage, type SqlDatabase } from '../../packages/storage/core';
import { type Bucket } from '../../packages/storage/objects';
import { applicationObjects } from '../../packages/storage/d1-objects';
import { processOddsPublication } from './odds-processing';
/** Service-binding-only worker. No public route, cron, or provider credential. */
export default {
  async fetch(
    request: Request,
    env: {
      APP_DB: SqlDatabase;
      D1_SHARED?: SqlDatabase;
      APP_OBJECT_BACKEND?: string;
      APP_OBJECTS?: Bucket;
      APP_BACKUP?: Bucket;
    },
  ) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/process')
      return new Response(null, { status: 404 });
    const metrics = requestMetrics(),
      db = instrumentDatabase(env.D1_SHARED ?? env.APP_DB, metrics, 50);
    const result = await processOddsPublication(
      new Storage(
        db,
        applicationObjects({ ...env, APP_DB: db }),
        env.D1_SHARED ? 'D1_SHARED' : undefined,
      ),
    );
    console.log(JSON.stringify({ metric: 'odds-processing', ...metrics, cpuMs: null }));
    return Response.json(result);
  },
};
