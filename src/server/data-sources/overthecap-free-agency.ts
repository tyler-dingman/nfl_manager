import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';
import { NFL_TEAM_SEED } from '@/server/ingest/teams';

const OTC_FREE_AGENCY_URL = 'https://overthecap.com/free-agency';

export type OtcFreeAgencyRow = {
  playerName: string;
  normalizedName: string;
  position: string | null;
  age: number | null;
  priorTeamAbbr: string | null;
  nextTeamAbbr: string | null;
  freeAgentType: string | null;
  otcStatus: string | null;
};

const stripTags = (value: string) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const findColumn = (headers: string[], tests: string[]) =>
  headers.findIndex((header) => tests.some((test) => normalizeHeader(header).includes(test)));

const parseInteger = (value: string | undefined): number | null => {
  const parsed = Number.parseInt((value ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const TEAM_ALIAS_TO_ABBR = (() => {
  const map = new Map<string, string>();
  NFL_TEAM_SEED.forEach((team) => {
    map.set(team.abbreviation.toLowerCase(), team.abbreviation);
    map.set(normalizeTeamName(team.name), team.abbreviation);
    map.set(normalizeTeamName(team.city), team.abbreviation);
    map.set(
      normalizeTeamName(`${team.city} ${team.name.replace(`${team.city} `, '')}`),
      team.abbreviation,
    );
  });
  map.set('washington commanders', 'WAS');
  map.set('washington football team', 'WAS');
  map.set('washington', 'WAS');
  map.set('las vegas', 'LV');
  map.set('new england', 'NE');
  map.set('green bay', 'GB');
  map.set('san francisco', 'SF');
  map.set('tampa bay', 'TB');
  map.set('new orleans', 'NO');
  return map;
})();

const normalizeTeamAbbr = (raw: string | undefined): string | null => {
  const value = (raw ?? '').trim();
  if (!value || value === '-' || value.toLowerCase() === 'fa') return null;
  const direct = TEAM_ALIAS_TO_ABBR.get(value.toLowerCase());
  if (direct) return direct;
  const normalized = TEAM_ALIAS_TO_ABBR.get(normalizeTeamName(value));
  return (
    (normalized ??
      value
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3)) ||
    null
  );
};

const parseRows = (html: string): OtcFreeAgencyRow[] => {
  const tables = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi));
  for (const table of tables) {
    const tableHtml = table[1] ?? '';
    const headers = Array.from(tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((m) =>
      stripTags(m[1] ?? ''),
    );
    if (headers.length === 0) continue;

    const playerIdx = findColumn(headers, ['player']);
    const priorTeamIdx = findColumn(headers, ['2025 team', 'former team']);
    const nextTeamIdx = findColumn(headers, ['2026 team', 'new team']);
    if (playerIdx < 0 || priorTeamIdx < 0 || nextTeamIdx < 0) continue;

    const positionIdx = findColumn(headers, ['pos']);
    const ageIdx = findColumn(headers, ['age']);
    const typeIdx = findColumn(headers, ['type', 'fa type']);
    const statusIdx = findColumn(headers, ['status']);

    const rows: OtcFreeAgencyRow[] = [];
    const trMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    trMatches.forEach((tr) => {
      const cells = Array.from((tr[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
        (m) => stripTags(m[1] ?? ''),
      );
      if (cells.length <= playerIdx) return;
      const playerName = cells[playerIdx] ?? '';
      if (!playerName || normalizeHeader(playerName) === 'player') return;

      const row: OtcFreeAgencyRow = {
        playerName,
        normalizedName: normalizePlayerName(playerName),
        position: positionIdx >= 0 ? cells[positionIdx] || null : null,
        age: ageIdx >= 0 ? parseInteger(cells[ageIdx]) : null,
        priorTeamAbbr: normalizeTeamAbbr(cells[priorTeamIdx]),
        nextTeamAbbr: normalizeTeamAbbr(cells[nextTeamIdx]),
        freeAgentType: typeIdx >= 0 ? cells[typeIdx] || null : null,
        otcStatus: statusIdx >= 0 ? cells[statusIdx] || null : null,
      };
      rows.push(row);
    });

    if (rows.length > 0) return rows;
  }
  return [];
};

export const fetchOtcFreeAgency = async (): Promise<OtcFreeAgencyRow[]> => {
  const response = await fetch(OTC_FREE_AGENCY_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`OTC free agency fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const rows = parseRows(html);
  const unsigned = rows.filter((row) => row.nextTeamAbbr === null).length;
  console.info(`[otc:fa] rows parsed=${rows.length}`);
  console.info(`[otc:fa] unsigned players parsed=${unsigned}`);
  return rows;
};
