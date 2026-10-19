import{applicationBackend,applicationStorage}from'../persistence/bindings';
import { randomUUID } from 'node:crypto';

import {
  EMPTY_FAN_PULSE_COUNTS,
  FAN_PULSE_REACTIONS,
  fanPulsePercentages,
  type FanPulseCounts,
  type FanPulseReaction,
} from '@/features/fan-pulse/model';
import { authDb } from '@/server/auth/database';

export async function getFanPulse(contentId: string, userId?: string | null) {
  const sql = applicationBackend()==='d1'?null:authDb();
  const rows = sql ? await sql<Array<{ reaction: FanPulseReaction; count: number }>>`
    SELECT reaction_type AS reaction, count(*)::int AS count
    FROM fan_pulse_reactions
    WHERE content_id = ${contentId}
    GROUP BY reaction_type` : await applicationStorage('D1_USERS').rows<{reaction:FanPulseReaction;count:number}>('SELECT reaction_type AS reaction,count(*) AS count FROM app_fan_pulse_reactions WHERE content_id=? GROUP BY reaction_type',[contentId]);
  const counts: FanPulseCounts = { ...EMPTY_FAN_PULSE_COUNTS };
  for (const row of rows) {
    if (FAN_PULSE_REACTIONS.includes(row.reaction)) counts[row.reaction] = row.count;
  }
  const selected = userId
    ? ((
        sql ? await sql<Array<{ reaction: FanPulseReaction }>>`
          SELECT reaction_type AS reaction FROM fan_pulse_reactions
          WHERE content_id = ${contentId} AND user_id = ${userId}` : await applicationStorage('D1_USERS').rows<{reaction:FanPulseReaction}>('SELECT reaction_type AS reaction FROM app_fan_pulse_reactions WHERE content_id=? AND user_id=?',[contentId,userId])
      )[0]?.reaction ?? null)
    : null;
  return {
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts,
    percentages: fanPulsePercentages(counts),
    selected,
  };
}

export async function setFanPulseReaction(input: {
  userId: string;
  contentId: string;
  teamId: string;
  reaction: FanPulseReaction;
}) {
  if(applicationBackend()==='d1')await applicationStorage('D1_USERS').statement('INSERT INTO app_fan_pulse_reactions(id,user_id,content_id,team_id,reaction_type,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,content_id) DO UPDATE SET team_id=excluded.team_id,reaction_type=excluded.reaction_type,updated_at=excluded.updated_at',[randomUUID(),input.userId,input.contentId,input.teamId,input.reaction,Date.now(),Date.now()]).run();
  else await authDb()`
    INSERT INTO fan_pulse_reactions (id, user_id, content_id, team_id, reaction_type)
    VALUES (${randomUUID()}, ${input.userId}, ${input.contentId}, ${input.teamId}, ${input.reaction})
    ON CONFLICT (user_id, content_id) DO UPDATE SET
      team_id = EXCLUDED.team_id,
      reaction_type = EXCLUDED.reaction_type,
      updated_at = now()`;
  return getFanPulse(input.contentId, input.userId);
}
