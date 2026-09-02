import type { TeamBriefing } from './types';

/** Shared HTTP contract for web today and native clients later. */
export async function recordBriefingConsumed(briefing: TeamBriefing) {
  try {
    await fetch('/api/user/content-state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        contentType: 'STORY',
        contentId: briefing.id,
        mediaVersion: briefing.updatedAt,
        viewed: true,
      }),
    });
  } catch {
    // Reading content must still work offline; a native client can retry this event later.
  }
}
