import accents from '../../../public/assets/the-beat-asset-library/config/team-accents.json';

export type BeatTeam = keyof typeof accents.teams;
const aliases: Record<string, BeatTeam> = {
  ARZ: 'ARI',
  BLT: 'BAL',
  CLV: 'CLE',
  GNB: 'GB',
  HST: 'HOU',
  JAC: 'JAX',
  KAN: 'KC',
  LA: 'LAR',
  STL: 'LAR',
  SD: 'LAC',
  SDG: 'LAC',
  OAK: 'LV',
  LVR: 'LV',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
  TAM: 'TB',
  WSH: 'WAS',
  WFT: 'WAS',
};
export function beatTeam(value: string): BeatTeam | null {
  const key = value.trim().toUpperCase();
  if (Object.hasOwn(accents.teams, key)) return key as BeatTeam;
  if (aliases[key]) return aliases[key];
  return (
    (Object.keys(accents.teams) as BeatTeam[]).find(
      (team) =>
        accents.teams[team].name.toUpperCase() === key ||
        accents.teams[team].name.toUpperCase().replaceAll(' ', '-') === key,
    ) ?? null
  );
}
export function beatPalette(value: string) {
  const team = beatTeam(value);
  const accent = team ? accents.teams[team].accent : accents.defaultAccent;
  const channels = [1, 3, 5].map((offset) => {
    const n = parseInt(accent.slice(offset, offset + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return { team, accent, onAccent: luminance > 0.18 ? '#0b1115' : '#fff' };
}
export const standardFamilies = ['standard-a', 'standard-b', 'standard-c', 'standard-d'] as const;
export function standardVariant(id: string) {
  let hash = 2166136261;
  for (const ch of id) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619);
  return standardFamilies[(hash >>> 0) % 4];
}
type StandardFamily = 'standard' | (typeof standardFamilies)[number];

export type BeatGraphicData =
  | { family: StandardFamily }
  | { family: 'game-matchup'; leftTeam: string; rightTeam: string; week?: string; kickoff?: string }
  | {
      family: 'game-result';
      leftTeam: string;
      rightTeam: string;
      leftScore: number;
      rightScore: number;
      final: 'FINAL' | 'FINAL · OT';
    }
  | { family: 'numbered'; count: string; descriptor: string }
  | {
      family: 'stats';
      count?: string;
      descriptor: string;
      rows: { value: string; label: string }[];
    }
  | {
      family: 'player';
      name: string;
      position?: string;
      jersey?: string;
      status?: string;
      context?: string;
    }
  | {
      family: 'injury';
      period?: string;
      rows: { count: number; status: string }[];
      detail?: string;
    }
  | {
      family: 'transaction';
      team: string;
      action:
        | 'SIGNED'
        | 'RELEASED'
        | 'ELEVATED'
        | 'TRADED'
        | 'WAIVED'
        | 'ACTIVATED'
        | 'ADDED'
        | 'CLAIMED'
        | 'PROMOTED'
        | 'PLACED_ON_IR'
        | 'PRACTICE_SQUAD'
        | 'OTHER';
      transactionType?: import('./beat-transaction').TransactionType;
      playerId?: string;
      origin?: string;
      players?: import('./beat-transaction').TransactionPlayer[];
      name: string;
      position?: string;
      jersey?: string;
      destination?: string;
      contract?: { term: string; value: string };
    }
  | { family: 'recap'; teams: string[]; overtime?: boolean }
  | { family: 'interview'; name?: string; transcript?: boolean }
  | { family: 'roster-roundup'; team: string }
  | { family: 'team-update'; label: string }
  | { family: 'depth-chart' | 'mailbag' | 'practice' }
  | { family: 'quote'; quote: string; attribution: string }
  | { family: 'developing'; updates: { time: string; detail: string }[] }
  | { family: 'business-community'; label: string }
  | { family: 'scouting'; opponent?: string }
  | { family: 'film' | 'coaching' | 'league'; label?: string }
  | { family: 'video'; title: string; mediaUrl: string };

const short = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const linesFit = (v: string, max: number, lines: number) =>
  v.split('\n').length <= lines && v.split(/\s+/).every((word) => word.length <= max);
/** Validate supported fields; optional facts are deliberately omitted when unavailable. */
export function validBeatGraphic(data: BeatGraphicData): boolean {
  switch (data.family) {
    case 'game-matchup':
      return (
        !!beatTeam(data.leftTeam ?? '') &&
        !!beatTeam(data.rightTeam ?? '') &&
        data.leftTeam !== data.rightTeam &&
        (!data.week || short(data.week, 16)) &&
        (!data.kickoff || short(data.kickoff, 25))
      );
    case 'game-result':
      return (
        !!beatTeam(data.leftTeam ?? '') &&
        !!beatTeam(data.rightTeam ?? '') &&
        data.leftTeam !== data.rightTeam &&
        [data.leftScore, data.rightScore].every((n) => Number.isInteger(n) && n >= 0 && n <= 99) &&
        ['FINAL', 'FINAL · OT'].includes(data.final)
      );
    case 'numbered':
      return (
        /^\d{1,2}(?:[×x]\d)?$/.test(data.count) &&
        short(data.descriptor, 28) &&
        linesFit(data.descriptor, 13, 2)
      );
    case 'stats':
      return (
        (!data.count || /^\d{1,2}$/.test(data.count)) &&
        short(data.descriptor, 16) &&
        Array.isArray(data.rows) &&
        data.rows.length <= 3 &&
        data.rows.every((row) => short(row.value, 10) && short(row.label, 22))
      );
    case 'player':
      return (
        short(data.name, 26) &&
        linesFit(data.name, 15, 2) &&
        (data.status ? !data.position || short(data.position, 3) : short(data.position, 3)) &&
        (!data.jersey || short(data.jersey, 3)) &&
        (!data.status || short(data.status, 40)) &&
        (!data.context || short(data.context, 24))
      );
    case 'injury':
      return (
        (!data.period || /^(W\d{1,2}|IR)$/.test(data.period)) &&
        Array.isArray(data.rows) &&
        data.rows.length <= 3 &&
        data.rows.every(
          (row) =>
            Number.isInteger(row.count) &&
            row.count >= 0 &&
            row.count <= 99 &&
            short(row.status, 13),
        )
      );
    case 'transaction':
      return (
        short(data.team, 3) &&
        [
          'SIGNED',
          'RELEASED',
          'ELEVATED',
          'TRADED',
          'WAIVED',
          'ACTIVATED',
          'ADDED',
          'CLAIMED',
          'PROMOTED',
          'PLACED_ON_IR',
          'PRACTICE_SQUAD',
          'OTHER',
        ].includes(data.action) &&
        short(data.name, 36) &&
        linesFit(data.name, 20, 2) &&
        (!data.players ||
          (data.players.length <= 2 &&
            data.players.every(
              (p) => short(p.name, 36) && (!p.position || short(p.position, 3)),
            ))) &&
        (!data.position || short(data.position, 3)) &&
        (!data.contract || (short(data.contract.term, 12) && short(data.contract.value, 10)))
      );
    case 'recap':
      return (
        Array.isArray(data.teams) &&
        data.teams.length >= 1 &&
        data.teams.length <= 2 &&
        data.teams.every((t) => !!beatTeam(t))
      );
    case 'interview':
      return false; // A transcript without an attributed quote is Standard, not a partial quote card.
    case 'roster-roundup':
      return short(data.team, 3);
    case 'team-update':
      return short(data.label, 28);
    case 'quote':
      return short(data.quote, 68) && linesFit(data.quote, 17, 3) && short(data.attribution, 32);
    case 'developing':
      return (
        Array.isArray(data.updates) &&
        data.updates.length >= 2 &&
        data.updates.length <= 3 &&
        data.updates.every((row) => short(row.time, 15) && short(row.detail, 44))
      );
    case 'business-community':
      return short(data.label, 28) && linesFit(data.label, 14, 2);
    case 'video':
      return short(data.title, 24) && /^https:\/\//.test(data.mediaUrl);
    case 'depth-chart':
    case 'mailbag':
    case 'practice':
    case 'scouting':
    case 'coaching':
    case 'film':
    case 'league':
      return true;
    default:
      return ['standard', ...standardFamilies].includes(data.family);
  }
}
export function classifyBeatGraphic(story: {
  id: string;
  category: string;
  graphic?: BeatGraphicData;
}): BeatGraphicData {
  if (story.graphic)
    return validBeatGraphic(story.graphic) ? story.graphic : { family: standardVariant(story.id) };
  const category = story.category.trim().toUpperCase().replaceAll('_', ' ');
  // These canonical categories describe a topic, not a fabricated factual event.
  if (category === 'COACHING') return { family: 'coaching' };
  if (['FILM', 'FILM STUDY', 'STRATEGY / FILM'].includes(category)) return { family: 'film' };
  if (['SCOUTING', 'OPPONENT'].includes(category)) return { family: 'scouting' };
  if (['LEAGUE', 'AROUND NFL', 'AROUND THE NFL'].includes(category)) return { family: 'league' };
  if (['BUSINESS', 'COMMUNITY', 'PARTNERSHIP'].includes(category))
    return { family: 'business-community', label: category };
  return { family: standardVariant(story.id) };
}
