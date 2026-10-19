import { runContentContinuations } from './continuations.mjs';
const endpoint = (baseUrl) => `${baseUrl.replace(/\/$/, '')}/api/automation/content/global`;

async function runAutomation(env) {
  if (!env.DND_AUTOMATION_BASE_URL || !env.DND_AUTOMATION_SECRET) {
    throw new Error('Content scheduler bindings are not configured.');
  }
  return runContentContinuations(async (query) => {
    const response = await fetch(endpoint(env.DND_AUTOMATION_BASE_URL) + '?' + query, {
      method: 'POST',
      redirect: 'manual',
      headers: { Authorization: `Bearer ${env.DND_AUTOMATION_SECRET}` },
    });
    if (!response.ok) throw Error(`Content continuation returned HTTP ${response.status}`);
    return response.json();
  });
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
