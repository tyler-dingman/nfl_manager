import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';
import { NFL_TEAM_SEED } from '@/server/ingest/teams';

const OTC_FREE_AGENCY_URL = 'https://overthecap.com/free-agency';
const OTC_DEFAULT_AJAX_ENDPOINT = 'https://overthecap.com/wp-admin/admin-ajax.php';
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
  freeAgentType: string | null;
  otcStatus: string | null;
};

type JsonRecord = Record<string, unknown>;

type ClientSourceProbeResult = {
  endpoint: string;
  action: string;
  season: string;
  payloadKind: 'json' | 'html';
  payload: unknown;
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

const stringifyValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = stripTags(value).trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const findRecordValue = (record: JsonRecord, tests: string[]): string | null => {
  const entries = Object.entries(record);
  for (const [key, raw] of entries) {
    const normalizedKey = normalizeHeader(key);
    if (tests.some((test) => normalizedKey.includes(test))) {
      const normalized = stringifyValue(raw);
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
};

const mapRecordToFreeAgentRow = (record: JsonRecord): OtcFreeAgencyRow | null => {
  const playerName =
    findRecordValue(record, ['player']) ?? findRecordValue(record, ['name']) ?? null;
  if (!playerName) {
    return null;
  }

  const position = findRecordValue(record, ['position']) ?? findRecordValue(record, ['pos']);
  const priorTeam =
    findRecordValue(record, ['2025 team']) ??
    findRecordValue(record, ['former team']) ??
    findRecordValue(record, ['prior team']) ??
    findRecordValue(record, ['previous team']) ??
    findRecordValue(record, ['old team']);
  const nextTeam =
    findRecordValue(record, ['2026 team']) ??
    findRecordValue(record, ['new team']) ??
    findRecordValue(record, ['signed with']) ??
    findRecordValue(record, ['to team']);
  const age = parseInteger(findRecordValue(record, ['age']) ?? undefined);
  const freeAgentType =
    findRecordValue(record, ['fa type']) ?? findRecordValue(record, ['type']) ?? null;
  const otcStatus = findRecordValue(record, ['status']) ?? null;

  return {
    playerName,
    normalizedName: normalizePlayerName(playerName),
    position,
    age,
    priorTeamAbbr: normalizeTeamAbbr(priorTeam ?? undefined),
    nextTeamAbbr: normalizeTeamAbbr(nextTeam ?? undefined),
    freeAgentType,
    otcStatus,
  };
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
        freeAgentType: typeIdx >= 0 ? cells[typeIdx] || null : null,
        otcStatus: statusIdx >= 0 ? cells[statusIdx] || null : null,
      };
      rows.push(row);
    });

    if (rows.length > 0) return rows;
  }
  return [];
};

const parseRowsFromJson = (payload: unknown): OtcFreeAgencyRow[] => {
  if (typeof payload === 'string') {
    const maybeHtmlRows = parseRows(payload);
    if (maybeHtmlRows.length > 0) {
      return maybeHtmlRows;
    }

    try {
      return parseRowsFromJson(JSON.parse(payload));
    } catch {
      return [];
    }
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }

    if (typeof payload[0] === 'object' && payload[0] !== null && !Array.isArray(payload[0])) {
      return payload
        .map((item) => mapRecordToFreeAgentRow(item as JsonRecord))
        .filter((item): item is OtcFreeAgencyRow => item !== null);
    }

    return [];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const obj = payload as JsonRecord;

  const nestedArrayKeys = ['data', 'rows', 'items', 'players', 'results'];
  for (const key of nestedArrayKeys) {
    if (key in obj) {
      const parsed = parseRowsFromJson(obj[key]);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  }

  const nestedHtmlKeys = ['html', 'table', 'tbody'];
  for (const key of nestedHtmlKeys) {
    const raw = obj[key];
    if (typeof raw === 'string') {
      const parsed = parseRows(raw);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  }

  return [];
};

const getLikelySeason = (html: string): string => {
  const tableYear = html.match(/id=["']table(\d{4})["']/i)?.[1];
  if (tableYear) {
    return tableYear;
  }
  return String(new Date().getUTCFullYear());
};

const discoverAjaxEndpoint = (html: string): string => {
  const ajaxUrlMatch = html.match(/https?:\/\/[^"'\s]*wp-admin\/admin-ajax\.php/i);
  if (ajaxUrlMatch?.[0]) {
    return ajaxUrlMatch[0].replace(/\\\//g, '/');
  }

  const relativeAjaxMatch = html.match(/["'](\/wp-admin\/admin-ajax\.php)["']/i);
  if (relativeAjaxMatch?.[1]) {
    return `https://overthecap.com${relativeAjaxMatch[1]}`;
  }

  return OTC_DEFAULT_AJAX_ENDPOINT;
};

const extractPotentialActions = (html: string): string[] => {
  const actions = new Set<string>([
    'get_free_agents',
    'get_free_agency',
    'free_agency',
    'free_agents',
    'otc_get_free_agents',
  ]);

  for (const match of html.matchAll(/action\s*[:=]\s*["']([a-z0-9_\-]*free[a-z0-9_\-]*)["']/gi)) {
    const action = match[1]?.trim();
    if (action) {
      actions.add(action);
    }
  }

  return Array.from(actions);
};

const fetchClientPopulatedRows = async (html: string): Promise<ClientSourceProbeResult | null> => {
  const season = getLikelySeason(html);
  const endpoint = discoverAjaxEndpoint(html);
  const actions = extractPotentialActions(html);

  for (const action of actions) {
    const formCandidates = [
      new URLSearchParams({ action, season }),
      new URLSearchParams({ action, year: season }),
      new URLSearchParams({ action, season, table: `table${season}` }),
      new URLSearchParams({ action, table_id: `table${season}` }),
      new URLSearchParams({ action, league_year: season }),
    ];

    for (const formBody of formCandidates) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: formBody.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      if (!text || text.trim() === '0') {
        continue;
      }

      let payload: unknown = text;
      let payloadKind: 'json' | 'html' = 'html';
      try {
        payload = JSON.parse(text);
        payloadKind = 'json';
      } catch {
        payloadKind = 'html';
      }

      const rows = payloadKind === 'json' ? parseRowsFromJson(payload) : parseRows(text);
      if (rows.length > 0) {
        return {
          endpoint,
          action,
          season,
          payloadKind,
          payload,
        };
      }
    }
  }

  return null;
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
  const response = await fetch(OTC_FREE_AGENCY_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`OTC free agency fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const serverRows = parseRows(html);
  if (serverRows.length > 0) {
    const unsigned = serverRows.filter((row) => row.nextTeamAbbr === null).length;
    const sample = serverRows.slice(0, 3).map((row) => ({
      playerName: row.playerName,
      position: row.position,
      priorTeamAbbr: row.priorTeamAbbr,
      nextTeamAbbr: row.nextTeamAbbr,
      freeAgentType: row.freeAgentType,
      age: row.age,
    }));
    console.info('[otc:fa] endpoint discovered=server-rendered-table');
    console.info(`[otc:fa] raw row count=${serverRows.length}`);
    console.info(`[otc:fa] rows parsed=${serverRows.length}`);
    console.info(`[otc:fa] unsigned players parsed=${unsigned}`);
    console.info(`[otc:fa] sample parsed rows=${JSON.stringify(sample)}`);
    console.info(
      `[otc:fa] deandre hopkins found=${serverRows.some((row) => row.normalizedName === normalizePlayerName('DeAndre Hopkins'))}`,
    );
    return serverRows;
  }

  const clientProbe = await fetchClientPopulatedRows(html);
  if (clientProbe) {
    const rows =
      clientProbe.payloadKind === 'json'
        ? parseRowsFromJson(clientProbe.payload)
        : parseRows(String(clientProbe.payload));
    const unsigned = rows.filter((row) => row.nextTeamAbbr === null).length;
    const sample = rows.slice(0, 3).map((row) => ({
      playerName: row.playerName,
      position: row.position,
      priorTeamAbbr: row.priorTeamAbbr,
      nextTeamAbbr: row.nextTeamAbbr,
      freeAgentType: row.freeAgentType,
      age: row.age,
    }));

    console.info(
      `[otc:fa] endpoint discovered=${clientProbe.endpoint} action=${clientProbe.action} season=${clientProbe.season}`,
    );
    console.info(`[otc:fa] raw row count=${rows.length}`);
    console.info(`[otc:fa] rows parsed=${rows.length}`);
    console.info(`[otc:fa] unsigned players parsed=${unsigned}`);
    console.info(`[otc:fa] sample parsed rows=${JSON.stringify(sample)}`);
    console.info(
      `[otc:fa] deandre hopkins found=${rows.some((row) => row.normalizedName === normalizePlayerName('DeAndre Hopkins'))}`,
    );

    return rows;
  }

  const fallbackRows = await fetchRowsFromLocalFallback();
  const unsigned = fallbackRows.filter((row) => row.nextTeamAbbr === null).length;
  const sample = fallbackRows.slice(0, 3).map((row) => ({
    playerName: row.playerName,
    position: row.position,
    priorTeamAbbr: row.priorTeamAbbr,
    nextTeamAbbr: row.nextTeamAbbr,
    freeAgentType: row.freeAgentType,
    age: row.age,
  }));
  console.info('[otc:fa] endpoint discovered=none (local fallback parse)');
  console.info(`[otc:fa] raw row count=${fallbackRows.length}`);
  console.info(`[otc:fa] rows parsed=${fallbackRows.length}`);
  console.info(`[otc:fa] unsigned players parsed=${unsigned}`);
  console.info(`[otc:fa] sample parsed rows=${JSON.stringify(sample)}`);
  console.info(
    `[otc:fa] deandre hopkins found=${fallbackRows.some((row) => row.normalizedName === normalizePlayerName('DeAndre Hopkins'))}`,
  );

  return fallbackRows;
};
