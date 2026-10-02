import type { Game, Play } from '../../../packages/huddle';
const abbr = (s: string) => ({ WSH: 'WAS', LA: 'LAR' })[s] ?? s;
const number = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
/** Adapter for the same ESPN source used by schedule/search. Missing geometry stays null. */
export function normalizeHuddleGame(payload: any): Game | null {
  const event = payload.header,
    c = event?.competitions?.[0];
  if (!c) return null;
  const home = c.competitors?.find((x: any) => x.homeAway === 'home'),
    away = c.competitors?.find((x: any) => x.homeAway === 'away');
  if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null;
  const status = c.status ?? {},
    situation = payload.situation ?? c.situation ?? {},
    current = payload.drives?.current;
  const drives = [...(payload.drives?.previous ?? []), ...(current ? [current] : [])];
  const plays = new Map<string, Play>();
  let sequence = 0;
  for (const drive of drives)
    for (const p of drive.plays ?? []) {
      if (!p.id || !p.text) continue;
      plays.set(String(p.id), {
        id: String(p.id),
        sequence: sequence++,
        quarter: p.period?.number ?? 0,
        clock: p.clock?.displayValue ?? '',
        down: p.start?.shortDownDistanceText ?? '',
        location: p.start?.possessionText ?? '',
        text: p.text,
        yards: number(p.statYardage),
        scoring: p.scoringPlay === true,
        key: p.scoringPlay === true || /intercept|fumble|sack|turnover|touchdown/i.test(p.text),
        driveId: String(drive.id ?? ''),
        at: p.wallclock ?? null,
      });
    }
  const possession = c.competitors?.find((x: any) => String(x.id) === String(situation.possession));
  const possessionAbbr = possession?.team?.abbreviation ? abbr(possession.team.abbreviation) : null;
  return {
    id: String(event.id),
    home: abbr(home.team.abbreviation),
    away: abbr(away.team.abbreviation),
    homeScore: number(home.score),
    awayScore: number(away.score),
    status: status.type?.completed
      ? 'final'
      : status.type?.name === 'STATUS_HALFTIME'
        ? 'halftime'
        : status.type?.state === 'in'
          ? 'live'
          : 'pregame',
    clock: status.displayClock ?? '',
    quarter: status.period ?? 0,
    kickoff: c.date ?? event.date,
    possession: possessionAbbr,
    down: situation.shortDownDistanceText ?? '',
    location: situation.possessionText ?? '',
    // Provider yardLine orientation is not contracted: only use an explicit team/yard label.
    ball: null,
    direction: 1,
    driveId: current?.id ? String(current.id) : null,
    driveSummary: current?.description ?? null,
    updatedAt: new Date().toISOString(),
    plays: [...plays.values()],
  };
}
export function fieldPosition(game: Game): Game {
  const match = /^([A-Z]{2,3})\s+(\d{1,2})$/.exec(game.location);
  if (!match || !game.possession) return game;
  const yard = Number(match[2]);
  if (yard > 50) return game;
  const side = abbr(match[1]);
  if (side !== game.home && side !== game.away) return game;
  return {
    ...game,
    ball: side === game.away ? yard : 100 - yard,
    direction: game.possession === game.away ? 1 : -1,
  };
}
/** Live provider access is disabled while The Huddle is a visual concept. */
export async function getHuddleGame(_team: string, _id?: string): Promise<Game | null> {
  return null;
}
