import { writeFile } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import { rankTrendingProps, representativeTrends } from '../packages/parlay/trending-selection';
import { calculatePlayerPropTrend } from '../src/server/historical-stats/trend-service';
import {
  normalizeHistoricalStatType,
  resolveHistoricalStat,
} from '../src/server/historical-stats/stat-resolver';
import {
  summarizeScoreAudit,
  type ScoredAuditRow,
} from '../src/server/historical-stats/score-audit';
import type { HistoricalPlayerGame } from '../src/server/historical-stats/types';
import { buildGameScriptContext } from '../src/server/historical-stats/game-script-context-service';

async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const { getPlayerGameLogs, getTeamSeasonStrength } =
    await import('../src/server/historical-stats/repository');
  const { getRoleEvidence } = await import('../src/server/historical-stats/role-repository');
  const db = authDb();
  const rows: ScoredAuditRow[] = [];
  const mode = process.argv.includes('--slate') ? 'slate' : 'backtest';
  const out = process.argv.find((v) => v.startsWith('--output='))?.slice(9);
  try {
    const events = await db<
      {
        id: string;
        home: string;
        away: string;
        cutoff: string;
        season: number;
        gameId: string | null;
      }[]
    >`
      SELECT e.id,e.home_team_id AS home,e.away_team_id AS away,e.season,g.id AS "gameId",
        (CASE WHEN ${mode}='slate' THEN now() ELSE e.kickoff_at - interval '1 hour' END)::text AS cutoff
      FROM sportsbook_events e LEFT JOIN historical_games g ON g.season=e.season AND g.week=e.week
        AND g.home_team_id=e.home_team_id AND g.away_team_id=e.away_team_id
      WHERE CASE WHEN ${mode}='slate' THEN e.kickoff_at>now() ELSE e.kickoff_at<now() AND g.id IS NOT NULL END
      ORDER BY e.kickoff_at`;
    const ids = await db<
      { id: string }[]
    >`SELECT DISTINCT player_id AS id FROM historical_player_games WHERE player_id IS NOT NULL AND position IN ('QB','RB','WR','TE')`;
    const games = await getPlayerGameLogs(ids.map((p) => p.id));
    const limitations = [
      'Weights and predictive distributions are not fitted or externally calibrated; this is a diagnostic backtest, not validation of profitability.',
      'One main offer per player/stat/book; reporting recommendations deduplicates books. Correlated props are not independent trials.',
      'Final historical stats are assumed available after each prior game; original stats publication times were not archived.',
      'Role evidence imported later is excluded using received_at; missing pregame snapshots remain missing.',
    ];
    for (const event of events) {
      const offers = await db<
        {
          playerId: string;
          teamId: string;
          marketType: string;
          line: number;
          side: string;
          sportsbook: string;
          odds: number;
        }[]
      >`
        WITH latest AS (
          SELECT DISTINCT ON (m.player_id,m.market_type,m.side,s.sportsbook)
            m.player_id AS "playerId",m.team_id AS "teamId",m.market_type AS "marketType",s.line::float8 AS line,s.odds::float8 AS odds,m.side,s.sportsbook,s.available
          FROM bet_markets m JOIN sportsbook_price_snapshots s ON s.market_id=m.id
          WHERE m.event_id=${event.id} AND m.period='game' AND m.is_alt_line=false AND m.player_id IS NOT NULL
            AND s.line IS NOT NULL AND s.captured_at<=${event.cutoff}::timestamptz
          ORDER BY m.player_id,m.market_type,m.side,s.sportsbook,s.captured_at DESC,s.id DESC
        ) SELECT * FROM latest WHERE available`;
      const evidenceByTeam = new Map(
        await Promise.all(
          [event.home, event.away].map(
            async (team) => [team, await getRoleEvidence([team], event.cutoff)] as const,
          ),
        ),
      );
      const environmentMarkets = await db<
        {
          marketType: string;
          side: string;
          teamId: string | null;
          entityId: string;
          line: number;
          available: boolean;
          period: string;
          isAltLine: boolean;
        }[]
      >`
        SELECT DISTINCT ON (m.market_type,m.side,s.sportsbook) m.market_type AS "marketType",m.side,m.team_id AS "teamId",m.entity_id AS "entityId",
          s.line::float8 AS line,s.available,m.period,m.is_alt_line AS "isAltLine"
        FROM bet_markets m JOIN sportsbook_price_snapshots s ON s.market_id=m.id
        WHERE m.event_id=${event.id} AND m.period='game' AND m.is_alt_line=false AND m.market_type IN ('SPREAD','TOTAL')
          AND s.captured_at<=${event.cutoff}::timestamptz
        ORDER BY m.market_type,m.side,s.sportsbook,s.captured_at DESC,s.id DESC`;
      const strengths = new Map(
        await Promise.all(
          [event.home, event.away].map(
            async (team) => [team, await getTeamSeasonStrength(team, event.season - 1)] as const,
          ),
        ),
      );
      // Restrict BOTH legacy and new inputs to prior games. No full-season current-year defensive ranks.
      const before = games.filter(
        (g) => Date.parse(g.kickoffAt ?? g.date) < Date.parse(event.cutoff),
      );
      const byTeam = new Map<string, HistoricalPlayerGame[]>();
      for (const team of [event.home, event.away]) {
        const players = new Set(
          before
            .filter((g) => g.teamId === team && g.season >= event.season - 1)
            .map((g) => g.playerId),
        );
        byTeam.set(
          team,
          before.filter((g) => players.has(g.playerId)),
        );
      }
      for (const offer of offers) {
        const statType = normalizeHistoricalStatType(offer.marketType);
        if (!statType || !['OVER', 'UNDER'].includes(offer.side)) continue;
        const playerGames = before.filter((g) => g.playerId === offer.playerId);
        if (playerGames.length < 3) continue;
        const team = offer.teamId ?? playerGames[0]?.teamId;
        const actual = games.find(
          (g) => g.playerId === offer.playerId && g.gameId === event.gameId,
        );
        const value = actual ? resolveHistoricalStat(actual, statType) : null;
        if (mode === 'backtest' && value == null) continue;
        const side = offer.side as 'OVER' | 'UNDER';
        const environment = buildGameScriptContext(environmentMarkets, team, statType, {
          homeTeamId: event.home,
          awayTeamId: event.away,
        });
        const trend = calculatePlayerPropTrend(byTeam.get(team) ?? playerGames, {
          playerId: offer.playerId,
          statType,
          line: offer.line,
          side,
          position: playerGames[0]?.position,
          lineType: 'main',
          opponentLogs: before.filter(
            (g) =>
              g.opponentTeamId === (team === event.home ? event.away : event.home) &&
              g.position === playerGames[0]?.position,
          ),
          scoreVersion: 'v2',
          strength: strengths.get(team === event.home ? event.away : event.home),
          spread: environment?.spread,
          projectionContext: {
            asOf: event.cutoff,
            odds: offer.odds,
            teamId: team,
            ...evidenceByTeam.get(team),
            total: environment?.total,
            debug: process.argv.includes('--debug'),
          },
        });
        rows.push({
          eventId: event.id,
          playerId: offer.playerId,
          position: playerGames[0]?.position ?? 'UNKNOWN',
          playerName: playerGames[0]?.playerName ?? offer.playerId,
          odds: offer.odds,
          sportsbook: offer.sportsbook,
          statType,
          side,
          legacyScore: trend.researchScore.score,
          projection: trend.projection,
          outcome:
            value == null
              ? null
              : value === offer.line
                ? 'PUSH'
                : (side === 'OVER' ? value > offer.line : value < offer.line)
                  ? 'WIN'
                  : 'LOSS',
        });
      }
    }
    const candidateKey = (r: ScoredAuditRow) => `${r.eventId}|${r.playerId}|${r.statType}`;
    const commonCandidates = new Set(
      rows.filter((r) => r.projection.recommendation === r.side).map(candidateKey),
    );
    const report = {
      mode,
      generatedAt: new Date().toISOString(),
      eventCount: events.length,
      evaluatedRows: rows.length,
      rollout: 'Opportunity model is the public default. Legacy scores are audit comparisons only.',
      trendingTop10: rankTrendingProps(
        representativeTrends(
          rows.map((r) => ({
            ...r,
            marketType: r.statType,
            trend: { trendScore: r.projection.score, projection: r.projection },
          })),
        ),
      )
        .slice(0, 10)
        .map((r) => ({
          playerId: r.playerId,
          statType: r.statType,
          side: r.side,
          score: r.projection.score,
          roleConfidence: r.projection.roleConfidence,
        })),
      confirmedRoleCoverage: rows.length
        ? rows.filter((r) => r.projection.dataQuality.currentRoleKnown).length / rows.length
        : 0,
      currentRoleCoverage: rows.length
        ? rows.filter((r) => r.projection.roleConfidence !== 'LOW').length / rows.length
        : 0,
      limitations,
      ...summarizeScoreAudit(rows),
      commonCandidateComparison: summarizeScoreAudit(
        rows.filter((r) => commonCandidates.has(candidateKey(r))),
      ),
      ...(process.argv.includes('--debug') ? { rows } : {}),
    };
    const json = JSON.stringify(report, null, 2);
    if (out) await writeFile(out, json + '\n');
    console.log(
      out
        ? JSON.stringify(
            {
              output: out,
              events: events.length,
              evaluatedRows: rows.length,
              legacy: report.legacy.direction,
              v2: report.v2.direction,
              currentRoleCoverage: report.currentRoleCoverage,
            },
            null,
            2,
          )
        : json,
    );
  } finally {
    await db.end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
