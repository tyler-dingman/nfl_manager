import { authDb } from '@/server/auth/database';
import type { FrontOfficeEvent, FrontOfficeTradeOfferStatus } from '@/types/front-office';
import type { TradeOfferDTO } from '@/types/trade-offers';

export type NewFrontOfficeEvent = Omit<
  FrontOfficeEvent,
  'createdAt' | 'readAt' | 'dismissedAt' | 'surfacedAt'
> & { dedupeKey: string };

type EventRow = FrontOfficeEvent;

const selectColumns = `
  id, save_id AS "saveId", type, priority, headline, summary,
  team_abbr AS "teamAbbr", related_team_abbr AS "relatedTeamAbbr",
  player_id AS "playerId", prospect_id AS "prospectId", trade_offer_id AS "tradeOfferId",
  simulation_season AS "simulationSeason", simulation_week AS "simulationWeek",
  simulation_phase AS "simulationPhase", action_url AS "actionUrl", metadata,
  created_at AS "createdAt", expires_at AS "expiresAt", read_at AS "readAt",
  dismissed_at AS "dismissedAt", surfaced_at AS "surfacedAt"`;

const surfacedSelectColumns = `
  e.id, e.save_id AS "saveId", e.type, e.priority, e.headline, e.summary,
  e.team_abbr AS "teamAbbr", e.related_team_abbr AS "relatedTeamAbbr",
  e.player_id AS "playerId", e.prospect_id AS "prospectId", e.trade_offer_id AS "tradeOfferId",
  e.simulation_season AS "simulationSeason", e.simulation_week AS "simulationWeek",
  e.simulation_phase AS "simulationPhase", e.action_url AS "actionUrl", e.metadata,
  e.created_at AS "createdAt", e.expires_at AS "expiresAt", e.read_at AS "readAt",
  e.dismissed_at AS "dismissedAt", e.surfaced_at AS "surfacedAt"`;

const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
const mapEvent = (row: EventRow): FrontOfficeEvent => ({
  ...row,
  createdAt: new Date(row.createdAt).toISOString(),
  expiresAt: iso(row.expiresAt),
  readAt: iso(row.readAt),
  dismissedAt: iso(row.dismissedAt),
  surfacedAt: iso(row.surfacedAt),
});

export async function persistFrontOfficeEvents(userId: string, events: NewFrontOfficeEvent[]) {
  const db = authDb();
  const persisted: FrontOfficeEvent[] = [];
  for (const event of events) {
    const rows = await db.unsafe<EventRow[]>(
      `INSERT INTO front_office_events
        (user_id, id, save_id, dedupe_key, type, priority, headline, summary, team_abbr,
         related_team_abbr, player_id, prospect_id, trade_offer_id, simulation_season,
         simulation_week, simulation_phase, action_url, metadata, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)
       ON CONFLICT (user_id, save_id, dedupe_key, simulation_season, simulation_week) DO NOTHING
       RETURNING ${selectColumns}`,
      [
        userId,
        event.id,
        event.saveId,
        event.dedupeKey,
        event.type,
        event.priority,
        event.headline,
        event.summary,
        event.teamAbbr,
        event.relatedTeamAbbr,
        event.playerId,
        event.prospectId,
        event.tradeOfferId,
        event.simulationSeason,
        event.simulationWeek,
        event.simulationPhase,
        event.actionUrl,
        JSON.stringify(event.metadata),
        event.expiresAt,
      ],
    );
    if (rows[0]) persisted.push(mapEvent(rows[0]));
  }
  return persisted;
}

export async function listFrontOfficeEvents(userId: string, saveId: string, unreadOnly = false) {
  const rows = await authDb().unsafe<EventRow[]>(
    `SELECT ${selectColumns} FROM front_office_events
     WHERE user_id = $1 AND save_id = $2 ${unreadOnly ? 'AND read_at IS NULL' : ''}
     ORDER BY created_at DESC LIMIT 100`,
    [userId, saveId],
  );
  return rows.map(mapEvent);
}

export async function surfaceNextFrontOfficeEvent(userId: string, saveId: string) {
  const rows = await authDb().unsafe<EventRow[]>(
    `WITH candidate AS (
       SELECT id FROM front_office_events
       WHERE user_id = $1 AND save_id = $2 AND surfaced_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC,
         created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     UPDATE front_office_events e SET surfaced_at = now()
     FROM candidate c WHERE e.user_id = $1 AND e.id = c.id
     RETURNING ${surfacedSelectColumns}`,
    [userId, saveId],
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function updateFrontOfficeEvent(
  userId: string,
  id: string,
  action: 'read' | 'dismiss',
) {
  const column = action === 'read' ? 'read_at' : 'dismissed_at';
  const rows = await authDb().unsafe<EventRow[]>(
    `UPDATE front_office_events SET ${column} = COALESCE(${column}, now())
     WHERE user_id = $1 AND id = $2 RETURNING ${selectColumns}`,
    [userId, id],
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function persistFrontOfficeTradeOffer(input: {
  userId: string;
  saveId: string;
  offer: TradeOfferDTO;
  createdWeek: number;
  expiresWeek: number;
}) {
  await authDb()`INSERT INTO front_office_trade_offers
    (user_id,id,save_id,proposing_team_abbr,receiving_team_abbr,offer_data,created_week,expires_week)
    VALUES (${input.userId},${input.offer.id},${input.saveId},${input.offer.proposingTeamAbbr},
      ${input.offer.outgoing.teamAbbr},${JSON.stringify(input.offer)}::jsonb,${input.createdWeek},${input.expiresWeek})
    ON CONFLICT (user_id,id) DO NOTHING`;
}

export async function getFrontOfficeTradeOffer(userId: string, id: string) {
  const rows = await authDb()<
    Array<{ offer: TradeOfferDTO; status: FrontOfficeTradeOfferStatus; expiresWeek: number }>
  >`
    SELECT offer_data AS offer, status, expires_week AS "expiresWeek"
    FROM front_office_trade_offers WHERE user_id=${userId} AND id=${id}`;
  return rows[0] ?? null;
}

export async function updateFrontOfficeTradeOfferStatus(
  userId: string,
  id: string,
  status: Exclude<FrontOfficeTradeOfferStatus, 'pending'>,
) {
  const rows = await authDb()<Array<{ id: string; status: FrontOfficeTradeOfferStatus }>>`
    UPDATE front_office_trade_offers SET status=${status}, responded_at=now(), updated_at=now()
    WHERE user_id=${userId} AND id=${id} AND status='pending' RETURNING id,status`;
  return rows[0] ?? null;
}

export async function expireFrontOfficeTradeOffers(
  userId: string,
  saveId: string,
  currentWeek: number,
) {
  await authDb()`UPDATE front_office_trade_offers SET status='expired',updated_at=now()
    WHERE user_id=${userId} AND save_id=${saveId} AND status='pending' AND expires_week < ${currentWeek}`;
}
