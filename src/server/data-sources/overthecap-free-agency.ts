import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';
import { NFL_TEAM_SEED } from '@/server/ingest/teams';

const OTC_DEFAULT_AJAX_ENDPOINT = 'https://overthecap.com/wp-admin/admin-ajax.php';
const OTC_FREE_AGENCY_SEASON = '2026';
const OTC_FREE_AGENCY_REQUEST_PAYLOAD = {
  action: 'get_free_agents',
  season: OTC_FREE_AGENCY_SEASON,
  team_id: '',
} as const;
const OTC_FREE_AGENCY_FALLBACK_FILES = [
  path.join(process.cwd(), 'data-cache/otc-free-agency-rendered.html'),
  path.join(process.cwd(), 'data-cache/otc-free-agency-2026-rendered.html'),
];

export type OtcFreeAgencyRow = {
  playerName: string;
  normalizedName: string;
  position: string | null;
  age: number | null;
  priorTeamAbbr: string | null;
  nextTeamAbbr: string | null;
  priorTeamLabel: string | null;
  nextTeamLabel: string | null;
  freeAgentType: string | null;
  snaps: string | null;
  currentApy: string | null;
  guarantees: string | null;
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
  if (!value || value === '-' || value === '—' || value.toLowerCase() === 'fa') return null;
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
        priorTeamLabel: priorTeamIdx >= 0 ? cells[priorTeamIdx] || null : null,
        nextTeamLabel: nextTeamIdx >= 0 ? cells[nextTeamIdx] || null : null,
        freeAgentType: typeIdx >= 0 ? cells[typeIdx] || null : null,
        snaps: null,
        currentApy: null,
        guarantees: null,
        otcStatus: statusIdx >= 0 ? cells[statusIdx] || null : null,
      };
      rows.push(row);
    });

    if (rows.length > 0) return rows;
  }
  return [];
};

const normalizeUnsignedTeam = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = normalizeTeamAbbr(trimmed);
  return normalized ?? null;
};

export const parseAjaxFreeAgencyRows = (html: string): OtcFreeAgencyRow[] => {
  const trMatches = Array.from(
    html.matchAll(/<tr[^>]*class=["'][^"']*\bsortable\b[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi),
  );
  const parsed: OtcFreeAgencyRow[] = [];
  trMatches.forEach((match) => {
    const rowHtml = match[0] ?? '';
    const inner = match[1] ?? '';
    const readAttr = (attributeName: string): string | null => {
      const regex = new RegExp(`${attributeName}=(["'])(.*?)\\1`, 'i');
      const value = rowHtml.match(regex)?.[2] ?? null;
      return value ? stripTags(value) : null;
    };
    const cells = Array.from(inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) =>
      stripTags(cell[1] ?? ''),
    );
    if (cells.length < 9) {
      return;
    }
    const playerName = cells[0] ?? '';
    if (!playerName) {
      return;
    }
    const dataOldTeam = readAttr('data-old-team');
    const dataNewTeam = readAttr('data-new-team');
    const dataPosition = readAttr('data-position');
    const dataFaType = readAttr('data-fatype');
    const nextTeamAbbr = normalizeUnsignedTeam(dataNewTeam);
    parsed.push({
      playerName,
      normalizedName: normalizePlayerName(playerName),
      position: dataPosition ?? cells[1] ?? null,
      age: parseInteger(cells[6]),
      priorTeamAbbr: normalizeTeamAbbr(dataOldTeam ?? cells[2] ?? undefined),
      nextTeamAbbr,
      priorTeamLabel: cells[2] ?? null,
      nextTeamLabel: cells[3] ?? null,
      freeAgentType: dataFaType ?? cells[4] ?? null,
      snaps: cells[5] ?? null,
      currentApy: cells[7] ?? null,
      guarantees: cells[8] ?? null,
      otcStatus: nextTeamAbbr === null ? 'unsigned' : 'signed',
    });
  });
  return parsed;
};

const fetchFreeAgencyAjaxRows = async (): Promise<OtcFreeAgencyRow[]> => {
  const formBody = new URLSearchParams(OTC_FREE_AGENCY_REQUEST_PAYLOAD);
  console.info('[otc:fa] endpoint discovered=admin-ajax');
  console.info(`[otc:fa] request payload=${JSON.stringify(OTC_FREE_AGENCY_REQUEST_PAYLOAD)}`);
  const response = await fetch(OTC_DEFAULT_AJAX_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: formBody.toString(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`OTC free agency ajax fetch failed: ${response.status}`);
  }
  const html = await response.text();
  const rows = parseAjaxFreeAgencyRows(html);
  return rows;
};

const fetchRowsFromLocalFallback = async (): Promise<OtcFreeAgencyRow[]> => {
  for (const fallbackPath of OTC_FREE_AGENCY_FALLBACK_FILES) {
    try {
      await access(fallbackPath);
    } catch {
      continue;
    }

    const fallbackText = await readFile(fallbackPath, 'utf8');
    const rows = parseRows(fallbackText);
    if (rows.length > 0) {
      console.info(`[otc:fa] using local fallback file=${fallbackPath}`);
      return rows;
    }
  }

  return [];
};

export const fetchOtcFreeAgency = async (): Promise<OtcFreeAgencyRow[]> => {
  try {
    const ajaxRows = await fetchFreeAgencyAjaxRows();
    const unsigned = ajaxRows.filter((row) => row.nextTeamAbbr === null).length;
    const sample = ajaxRows.slice(0, 3).map((row) => ({
      playerName: row.playerName,
      position: row.position,
      priorTeamAbbr: row.priorTeamAbbr,
      nextTeamAbbr: row.nextTeamAbbr,
      freeAgentType: row.freeAgentType,
      snaps: row.snaps,
      age: row.age,
      currentApy: row.currentApy,
      guarantees: row.guarantees,
    }));
    const foundHopkins = ajaxRows.some(
      (row) => row.normalizedName === normalizePlayerName('DeAndre Hopkins'),
    );
    console.info(`[otc:fa] raw row count=${ajaxRows.length}`);
    console.info(`[otc:fa] rows parsed=${ajaxRows.length}`);
    console.info(`[otc:fa] unsigned players parsed=${unsigned}`);
    console.info(`[otc:fa] sample parsed rows=${JSON.stringify(sample)}`);
    console.info(`[otc:fa] deandre hopkins found=${foundHopkins}`);
    if (!foundHopkins) {
      console.warn('[otc:fa] validation warning: deandre hopkins missing from parsed rows');
    }
    if (unsigned <= 0) {
      console.warn('[otc:fa] validation warning: unsigned players parsed=0');
    }
    return ajaxRows;
  } catch (error: unknown) {
    console.warn('[otc:fa] ajax fetch failed; trying local fallback', error);
  }

  const fallbackRows = await fetchRowsFromLocalFallback();
  const unsigned = fallbackRows.filter((row) => row.nextTeamAbbr === null).length;
  const sample = fallbackRows.slice(0, 3).map((row) => ({
    playerName: row.playerName,
    position: row.position,
    priorTeamAbbr: row.priorTeamAbbr,
    nextTeamAbbr: row.nextTeamAbbr,
    freeAgentType: row.freeAgentType,
    snaps: row.snaps,
    age: row.age,
    currentApy: row.currentApy,
    guarantees: row.guarantees,
  }));
  console.info('[otc:fa] endpoint discovered=local-fallback');
  console.info(`[otc:fa] raw row count=${fallbackRows.length}`);
  console.info(`[otc:fa] rows parsed=${fallbackRows.length}`);
  console.info(`[otc:fa] unsigned players parsed=${unsigned}`);
  console.info(`[otc:fa] sample parsed rows=${JSON.stringify(sample)}`);
  console.info(
    `[otc:fa] deandre hopkins found=${fallbackRows.some((row) => row.normalizedName === normalizePlayerName('DeAndre Hopkins'))}`,
  );

  return fallbackRows;
};
