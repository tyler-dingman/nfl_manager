import { z } from 'zod';
import type { RoleObservation } from '../../../packages/parlay/role-evidence';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { normalizePlayerName } from '@/server/ingest/normalize';

const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
export const roleObservationSchema = z
  .object({
    playerId: z.string().min(1),
    teamId: z.string().min(2),
    position: z.string().min(1),
    playerName: z.string().optional(),
    source: z.string().min(1),
    kind: z.enum(['official_injury', 'inactive', 'depth', 'report', 'usage']),
    sourceAt: timestamp,
    receivedAt: timestamp,
    status: z.enum(['AVAILABLE', 'OUT', 'IR', 'SUSPENDED', 'QUESTIONABLE', 'RETURNING']).optional(),
    depthRank: z.number().int().positive().optional(),
    expected: z
      .object({
        carries: z.number().nonnegative().nullable().optional(),
        targets: z.number().nonnegative().nullable().optional(),
        passingAttempts: z.number().nonnegative().nullable().optional(),
        snapShare: z.number().min(0).max(1).nullable().optional(),
        routes: z.number().nonnegative().nullable().optional(),
      })
      .optional(),
    change: z.enum(['PROMOTED', 'DEMOTED', 'TRADED', 'SIGNED', 'RELEASED', 'COACHING']).optional(),
  })
  .strict();
const teamCode = (team: string) => ({ LA: 'LAR', JAC: 'JAX', WSH: 'WAS' })[team] ?? team;
function identity(name: string, team: string, position?: string) {
  const matches = NFL_LEAGUE_DATA.players.filter(
    (p) =>
      p.teamAbbr === teamCode(team) &&
      normalizePlayerName(p.name) === normalizePlayerName(name) &&
      (!position || p.position === position),
  );
  return matches.length === 1 ? matches[0] : null;
}
export function parseDepthEvidence(rows: Record<string, string>[], receivedAt: string) {
  const observations: RoleObservation[] = [];
  let unmapped = 0,
    invalid = 0;
  for (const row of rows) {
    const position = row.pos_abb;
    if (!['QB', 'RB', 'WR', 'TE'].includes(position)) continue;
    const p = identity(row.player_name, row.team, position);
    if (!p) {
      unmapped++;
      continue;
    }
    const rank = Number(row.pos_rank);
    // 2025+ feed is timestamped; old season/week rows cannot prove current depth.
    if (
      !Number.isFinite(Date.parse(row.dt)) ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      Date.parse(row.dt) > Date.parse(receivedAt)
    ) {
      invalid++;
      continue;
    }
    observations.push({
      playerId: p.id,
      playerName: p.name,
      teamId: p.teamAbbr,
      position: p.position,
      source: 'nflverse:depth',
      kind: 'depth',
      sourceAt: row.dt,
      receivedAt,
      depthRank: rank,
    });
  }
  return { observations, unmapped, invalid };
}
const injuryFeed = z.object({
  timestamp: z.string().optional(),
  injuries: z.array(
    z.object({
      displayName: z.string(),
      injuries: z.array(
        z.object({
          date: z.string(),
          status: z.string(),
          athlete: z.object({
            displayName: z.string(),
            position: z.object({ abbreviation: z.string() }).optional(),
          }),
        }),
      ),
    }),
  ),
});
export function parseInjuryEvidence(value: unknown, receivedAt: string) {
  const feed = injuryFeed.parse(value),
    observations: RoleObservation[] = [];
  let unmapped = 0,
    invalid = 0;
  for (const group of feed.injuries) {
    const team = NFL_LEAGUE_DATA.teams.find((t) => t.name === group.displayName)?.abbr;
    for (const row of group.injuries) {
      const p = team
        ? identity(row.athlete.displayName, team, row.athlete.position?.abbreviation)
        : null;
      if (!p) {
        unmapped++;
        continue;
      }
      const status = (
        {
          out: 'OUT',
          'injured reserve': 'IR',
          suspension: 'SUSPENDED',
          suspended: 'SUSPENDED',
          questionable: 'QUESTIONABLE',
          doubtful: 'QUESTIONABLE',
          active: 'AVAILABLE',
        } as const
      )[row.status.toLowerCase()];
      if (
        !status ||
        !Number.isFinite(Date.parse(row.date)) ||
        Date.parse(row.date) > Date.parse(receivedAt)
      ) {
        invalid++;
        continue;
      }
      observations.push({
        playerId: p.id,
        playerName: p.name,
        position: p.position,
        teamId: p.teamAbbr,
        source: 'espn:injuries',
        kind: 'report',
        sourceAt: row.date,
        receivedAt,
        status,
      });
    }
  }
  return {
    observations,
    unmapped,
    invalid,
    sourceAt: feed.timestamp && Number.isFinite(Date.parse(feed.timestamp)) ? feed.timestamp : null,
  };
}
