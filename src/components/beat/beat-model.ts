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
type Three<T> = [T, T, T];
export type BeatGraphicData =
  | { family: StandardFamily }
  | { family: 'game-matchup'; home: string; away: string; week: string; kickoff: string }
  | {
      family: 'game-result';
      home: string;
      away: string;
      homeScore: number;
      awayScore: number;
      final: 'FINAL' | 'FINAL · OT';
    }
  | { family: 'numbered'; count: string; descriptor: string }
  | {
      family: 'stats';
      count: string;
      descriptor: string;
      rows: Three<{ value: string; label: string }>;
    }
  | { family: 'player'; name: string; position: string; jersey?: string }
  | { family: 'injury'; period: string; rows: Three<{ count: number; status: string }> }
  | {
      family: 'transaction';
      team: string;
      action: 'SIGNED' | 'RELEASED' | 'ELEVATED' | 'TRADED' | 'WAIVED';
      name: string;
      position: string;
      jersey?: string;
      contract?: { term: string; value: string };
    }
  | { family: 'quote'; quote: string; attribution: string }
  | { family: 'developing'; updates: Three<{ time: string; detail: string }> }
  | { family: 'business-community'; label: string }
  | { family: 'scouting'; opponent?: string }
  | { family: 'film' | 'coaching' | 'league' }
  | { family: 'video'; title: string; mediaUrl: string };

const short = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const linesFit = (v: string, max: number, lines: number) =>
  v.split('\n').length <= lines && v.split(/\s+/).every((word) => word.length <= max);
/** Structured data only; never extract a score, quotation or medical status from headlines. */
export function validBeatGraphic(data: BeatGraphicData): boolean {
  switch (data.family) {
    case 'game-matchup':
      return (
        short(data.home, 3) &&
        short(data.away, 3) &&
        short(data.week, 10) &&
        short(data.kickoff, 25)
      );
    case 'game-result':
      return (
        short(data.home, 3) &&
        short(data.away, 3) &&
        [data.homeScore, data.awayScore].every((n) => Number.isInteger(n) && n >= 0 && n <= 99) &&
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
        /^\d{1,2}$/.test(data.count) &&
        short(data.descriptor, 16) &&
        data.rows?.length === 3 &&
        data.rows.every((row) => short(row.value, 10) && short(row.label, 22))
      );
    case 'player':
      return (
        short(data.name, 26) &&
        linesFit(data.name, 10, 2) &&
        data.name.trim().split(/\s+/).length <= 2 &&
        short(data.position, 3) &&
        (!data.jersey || short(data.jersey, 3))
      );
    case 'injury':
      return (
        /^(W\d{1,2}|IR)$/.test(data.period) &&
        data.rows?.length === 3 &&
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
        ['SIGNED', 'RELEASED', 'ELEVATED', 'TRADED', 'WAIVED'].includes(data.action) &&
        short(data.name, 25) &&
        linesFit(data.name, 18, 1) &&
        short(data.position, 3) &&
        (!data.contract || (short(data.contract.term, 12) && short(data.contract.value, 10)))
      );
    case 'quote':
      return short(data.quote, 68) && linesFit(data.quote, 17, 3) && short(data.attribution, 32);
    case 'developing':
      return (
        data.updates?.length === 3 &&
        data.updates.every((row) => short(row.time, 15) && short(row.detail, 44))
      );
    case 'business-community':
      return short(data.label, 28) && linesFit(data.label, 14, 2);
    case 'video':
      return short(data.title, 24) && /^https:\/\//.test(data.mediaUrl);
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
