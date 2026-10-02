import { TEAM_LIST } from '@/data/teams';
import { GAME_RESULT_HEADLINE_PATTERN } from '@/lib/front-office-news-notifications';
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

// Older writes double-encoded JSON; normalize these when querying without changing other saves.
const normalizedMetadataSql =
  "(CASE WHEN jsonb_typeof(metadata) = 'string' THEN (metadata #>> '{}')::jsonb ELSE metadata END)";
// Apply before pagination, counts, and toast selection, including historical untagged recaps.
const newsNotificationSql = `type <> 'welcome_message'
  AND UPPER(COALESCE(${normalizedMetadataSql}->>'channel','')) <> 'MESSAGE'
  AND UPPER(COALESCE(${normalizedMetadataSql}->>'newsCategory','')) NOT IN ('GAME_RECAP','GAME_RESULT','GAME')
  AND id NOT LIKE '%:game-result:%'
  AND NOT (${normalizedMetadataSql}->>'homeScore' IS NOT NULL AND ${normalizedMetadataSql}->>'awayScore' IS NOT NULL)
  AND headline !~* '${GAME_RESULT_HEADLINE_PATTERN.replaceAll("'", "''")}'`;

const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
const mapEvent = (row: EventRow): FrontOfficeEvent => ({
  ...row,
  metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  simulationWeek: Math.max(1, row.simulationWeek),
  createdAt: new Date(row.createdAt).toISOString(),
  expiresAt: iso(row.expiresAt),
  readAt: iso(row.readAt),
  dismissedAt: iso(row.dismissedAt),
  surfacedAt: iso(row.surfacedAt),
});

export async function persistFrontOfficeEvents(
  userId: string,
  events: NewFrontOfficeEvent[],
  db = authDb(),
) {
  const persisted: FrontOfficeEvent[] = [];
  for (const event of events) {
    const rows = await db.unsafe<EventRow[]>(
      `INSERT INTO front_office_events
        (user_id, id, save_id, dedupe_key, type, priority, headline, summary, team_abbr,
         related_team_abbr, player_id, prospect_id, trade_offer_id, simulation_season,
         simulation_week, simulation_phase, action_url, metadata, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)
       ON CONFLICT DO NOTHING
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
        db.json(event.metadata as any),
        event.expiresAt,
      ],
    );
    if (rows[0]) persisted.push(mapEvent(rows[0]));
  }
  return persisted;
}

export async function listFrontOfficeEvents(
  userId: string,
  saveId: string,
  unreadOnly = false,
  offset = 0,
  notificationsOnly = false,
  options: {
    limit?: number;
    team?: string;
    filter?: string;
    query?: string;
    category?: string;
  } = {},
) {
  const rows = await authDb().unsafe<EventRow[]>(
    `SELECT ${selectColumns} FROM front_office_events
     WHERE user_id = $1 AND save_id = $2 ${unreadOnly ? 'AND read_at IS NULL' : ''}
     ${notificationsOnly ? `AND ${newsNotificationSql}` : ''}
     AND ($4 = '' OR concat_ws(' ', headline, summary, team_abbr, related_team_abbr, ${normalizedMetadataSql}->>'newsCategory') ILIKE '%' || $4 || '%')
     AND ($5 = 'all' OR ($5 = 'team' AND (team_abbr=$6 OR related_team_abbr=$6 OR ${normalizedMetadataSql}->'teamIds' ? $6))
       OR ($5 = 'league' AND NOT (COALESCE(team_abbr,'')=$6 OR COALESCE(related_team_abbr,'')=$6 OR COALESCE(${normalizedMetadataSql}->'teamIds','[]'::jsonb) ? $6))
       OR ($5 = 'breaking' AND ${normalizedMetadataSql}->>'isBreaking' = 'true'))
     AND ($7 = '' OR UPPER(COALESCE(${normalizedMetadataSql}->>'newsCategory','')) = $7)
     ORDER BY created_at DESC, id DESC LIMIT $8 OFFSET $3`,
    [
      userId,
      saveId,
      offset,
      TEAM_LIST.find(
        (t) =>
          t.name.toLowerCase().includes((options.query ?? '').toLowerCase()) &&
          (options.query ?? '').length > 2,
      )?.abbr ??
        options.query ??
        '',
      options.filter ?? 'all',
      options.team ?? '',
      options.category ?? '',
      Math.min(60, Math.max(1, options.limit ?? 60)),
    ],
  );
  return rows.map(mapEvent);
}

export async function frontOfficeNewsCounts(userId: string, saveId: string, team: string) {
  const [row] = await authDb().unsafe<
    Array<{ all: number; team: number; league: number; breaking: number }>
  >(
    `SELECT count(*)::int AS all,
 count(*) FILTER (WHERE team_abbr=$3 OR related_team_abbr=$3 OR ${normalizedMetadataSql}->'teamIds' ? $3)::int AS team,
 count(*) FILTER (WHERE NOT (COALESCE(team_abbr,'')=$3 OR COALESCE(related_team_abbr,'')=$3 OR COALESCE(${normalizedMetadataSql}->'teamIds','[]'::jsonb) ? $3))::int AS league,
 count(*) FILTER (WHERE ${normalizedMetadataSql}->>'isBreaking' = 'true')::int AS breaking
 FROM front_office_events WHERE user_id=$1 AND save_id=$2 AND ${newsNotificationSql}`,
    [userId, saveId, team],
  );
  const categories = await authDb().unsafe<Array<{ category: string; count: number }>>(
    `SELECT ${normalizedMetadataSql}->>'newsCategory' AS category,count(*)::int AS count FROM front_office_events WHERE user_id=$1 AND save_id=$2 AND ${newsNotificationSql} GROUP BY ${normalizedMetadataSql}->>'newsCategory'`,
    [userId, saveId],
  );
  return { ...row, categories };
}

export async function countUnreadFrontOfficeNews(userId: string, saveId: string) {
  const rows = await authDb().unsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM front_office_events
     WHERE user_id=$1 AND save_id=$2 AND read_at IS NULL AND ${newsNotificationSql}`,
    [userId, saveId],
  );
  return rows[0]?.count ?? 0;
}

export async function getFrontOfficeEvent(userId: string, id: string) {
  const rows = await authDb().unsafe<EventRow[]>(
    `SELECT ${selectColumns} FROM front_office_events WHERE user_id = $1 AND id = $2 LIMIT 1`,
    [userId, id],
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function surfaceNextFrontOfficeEvent(
  userId: string,
  saveId: string,
  teamAbbr?: string,
) {
  const rows = await authDb().unsafe<EventRow[]>(
    `WITH candidate AS (
       SELECT id FROM front_office_events
       WHERE user_id = $1 AND save_id = $2 AND surfaced_at IS NULL
         AND read_at IS NULL
         AND ${normalizedMetadataSql}->>'resolution' IS NULL
         AND ${newsNotificationSql}
         AND priority IN ('urgent', 'high')
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY CASE
         WHEN priority = 'urgent' AND ($3::text IS NOT NULL) AND
           (team_abbr = $3 OR related_team_abbr = $3 OR ${normalizedMetadataSql}->'teamIds' ? $3) THEN 4
         WHEN priority = 'urgent' THEN 3
         WHEN ($3::text IS NOT NULL) AND
           (team_abbr = $3 OR related_team_abbr = $3 OR ${normalizedMetadataSql}->'teamIds' ? $3) THEN 2
         ELSE 1 END DESC,
         created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     UPDATE front_office_events e SET surfaced_at = now()
     FROM candidate c WHERE e.user_id = $1 AND e.id = c.id
     RETURNING ${surfacedSelectColumns}`,
    [userId, saveId, teamAbbr ?? null],
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function markAllFrontOfficeEventsRead(userId: string, saveId: string) {
  await authDb().unsafe(
    `UPDATE front_office_events SET read_at = COALESCE(read_at, now())
     WHERE user_id = $1 AND save_id = $2
       AND ${newsNotificationSql}`,
    [userId, saveId],
  );
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

export async function resolveFrontOfficeEventsForPlayer(
  userId: string,
  saveId: string,
  playerId: string,
  resolution: 'signed' | 'invalidated',
) {
  const rows = await authDb().unsafe<EventRow[]>(
    `UPDATE front_office_events
     SET metadata = ${normalizedMetadataSql} || jsonb_build_object('resolution', $4::text, 'resolvedAt', now()::text),
       action_url = NULL,
       read_at = COALESCE(read_at, now())
     WHERE user_id = $1 AND save_id = $2 AND player_id = $3
       AND type = 're_sign_ready' AND ${normalizedMetadataSql}->>'resolution' IS NULL
     RETURNING ${selectColumns}`,
    [userId, saveId, playerId, resolution],
  );
  return rows.map(mapEvent);
}

export async function persistFrontOfficeTradeOffer(input: {
  userId: string;
  saveId: string;
  offer: TradeOfferDTO;
  createdWeek: number;
  expiresWeek: number;
}) {
  const db = authDb();
  await db`INSERT INTO front_office_trade_offers
    (user_id,id,save_id,proposing_team_abbr,receiving_team_abbr,offer_data,created_week,expires_week)
    VALUES (${input.userId},${input.offer.id},${input.saveId},${input.offer.proposingTeamAbbr},
      ${input.offer.outgoing.teamAbbr},${db.json(input.offer as any)},${input.createdWeek},${input.expiresWeek})
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
