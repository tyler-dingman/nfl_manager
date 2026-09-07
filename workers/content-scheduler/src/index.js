const endpoint = (baseUrl) => `${baseUrl.replace(/\/$/, '')}/api/automation/content/global`;

async function runAutomation(env) {
  if (!env.DND_AUTOMATION_BASE_URL || !env.DND_AUTOMATION_SECRET) {
    throw new Error('Content scheduler bindings are not configured.');
  }
  const response = await fetch(endpoint(env.DND_AUTOMATION_BASE_URL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DND_AUTOMATION_SECRET}`,
      'User-Agent': 'DownDistanceCloudflareScheduler/1.0',
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`D&D automation returned ${response.status}: ${body}`);
  console.log(`D&D global content automation: ${body}`);
}

export default {
  async fetch() {
    return Response.json({
      ok: true,
      service: 'dnd-content-scheduler',
    });
  },

  async scheduled(_event, env, context) {
    context.waitUntil(runAutomation(env));
  },
};
