/** Each call is a separate API invocation. Never forward a server-supplied URL.
 * An interrupted runner can start at poll again: leases/inboxes are durable. */
export async function runContentContinuations(send, limit = 32) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 32)
    throw Error('Invalid continuation bound');
  let action = 'poll',
    batch = null,
    pollIdle = false,
    owner = null;
  for (let calls = 1; calls <= limit; calls++) {
    if (owner && calls === limit) {
      const checkpoint = new URLSearchParams({ action: 'checkpoint', owner, resume: action });
      if (batch) checkpoint.set('batch', batch);
      const saved = await send(checkpoint);
      if (saved?.ok !== true) throw Error('Checkpoint failed');
      return { calls, complete: false };
    }
    const query = new URLSearchParams({ action });
    if (batch) query.set('batch', batch);
    if (owner) query.set('owner', owner);
    const body = await send(query);
    if (!body || body.ok !== true) throw Error('Content continuation failed');
    if (body.skipped || !body.nextAction) return { calls, complete: true };
    if (body.owner) {
      if (!/^D1_(TEAM_[1-8]|SHARED)$/.test(body.owner)) throw Error('Invalid editorial owner');
      owner = body.owner;
    }
    if (body.ownerIdle === true) {
      if (body.nextOwner) {
        if (!/^D1_(TEAM_[1-8]|SHARED)$/.test(body.nextOwner)) throw Error('Invalid next owner');
        owner = body.nextOwner;
        action = 'poll';
        batch = null;
        pollIdle = false;
        continue;
      }
      if (owner) {
        const saved = await send(
          new URLSearchParams({ action: 'checkpoint', owner: 'D1_TEAM_1', resume: 'poll' }),
        );
        if (saved?.ok !== true) throw Error('Checkpoint failed');
        return { calls: calls + 1, complete: true };
      }
    }
    if (action === 'poll') pollIdle = body.busyOrNoDueSources === true;
    if (
      (action === 'candidate' && !body.job && body.nextAction !== 'handoff') ||
      (action === 'handoff' && body.done)
    ) {
      if (pollIdle) {
        if (body.nextOwner) {
          if (!/^D1_(TEAM_[1-8]|SHARED)$/.test(body.nextOwner)) throw Error('Invalid next owner');
          owner = body.nextOwner;
          pollIdle = false;
        } else {
          if (owner) {
            await send(
              new URLSearchParams({ action: 'checkpoint', owner: 'D1_TEAM_1', resume: 'poll' }),
            );
            return { calls: calls + 1, complete: true };
          }
          return { calls, complete: true };
        }
      }
      action = 'poll';
      batch = null;
      continue;
    }
    if (!['poll', 'candidate', 'dispatch', 'handoff'].includes(body.nextAction))
      throw Error('Invalid continuation action');
    action = body.nextAction;
    batch = typeof body.batch === 'string' ? body.batch : null;
  }
  return { calls: limit, complete: false }; // Next tick reclaims after expiry.
}
