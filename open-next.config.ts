import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// Local compatibility experiment only. No paid cache/queue/DO is provisioned.
export default defineCloudflareConfig({
  incrementalCache: 'dummy',
  tagCache: 'dummy',
  queue: 'dummy',
  routePreloadingBehavior: 'none',
});
