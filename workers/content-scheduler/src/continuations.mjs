/** Each call is a separate API invocation. Never forward a server-supplied URL.
 * An interrupted runner can start at poll again: leases/inboxes are durable. */
export async function runContentContinuations(send, limit = 32) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 32)
    throw Error('Invalid continuation bound');
  let action = 'poll',
    batch = null,
    pollIdle = false;
  for (let calls = 1; calls <= limit; calls++) {
    const query = new URLSearchParams({ action });
    if (batch) query.set('batch', batch);
    const body = await send(query);
    if (!body || body.ok !== true) throw Error('Content continuation failed');
    if (body.skipped || !body.nextAction) return { calls, complete: true };
    if (action === 'poll') pollIdle = body.busyOrNoDueSources === true;
    if (action === 'candidate' && !body.job) {
      if (pollIdle) return { calls, complete: true };
      action = 'poll';
      batch = null;
      continue;
    }
    if (!['poll', 'candidate'].includes(body.nextAction))
      throw Error('Invalid continuation action');
    action = body.nextAction;
    batch = typeof body.batch === 'string' ? body.batch : null;
  }
  return { calls: limit, complete: false }; // Next tick reclaims after expiry.
}
