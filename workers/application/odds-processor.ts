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
      APP_OBJECT_BACKEND?: string;
      APP_OBJECTS?: Bucket;
      APP_BACKUP?: Bucket;
    },
  ) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/process')
      return new Response(null, { status: 404 });
    return Response.json(
      await processOddsPublication(new Storage(env.APP_DB, applicationObjects(env))),
    );
  },
};
