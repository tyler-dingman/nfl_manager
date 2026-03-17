import { normalizeTeamName, normalizeTeamSlug } from '@/server/ingest/normalize';
import { NFL_TEAM_SEED, TEAM_ALIAS_TO_ABBR } from '@/server/ingest/teams';

const OVER_THE_CAP_URL = 'https://overthecap.com/salary-cap-space';

export type TeamCapSourceRecord = {
  teamName: string;
  teamSlug: string | null;
  normalizedTeamName: string;
  capSpace: number | null;
  effectiveCapSpace: number | null;
  totalCapSpending: number | null;
  deadCap: number | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

const stripTags = (value: string) =>
  decodeHtml(
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const parseCurrency = (value: string): number | null => {
  const raw = value.trim();
  if (!raw || raw === '-' || raw.toLowerCase() === 'n/a') {
    return null;
  }
  const negative = raw.includes('(') || raw.startsWith('-');
  const digits = raw.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const parsed = Number.parseFloat(digits);
  if (Number.isNaN(parsed)) return null;
  return negative ? -Math.round(parsed) : Math.round(parsed);
};

const getTeamSlug = (teamCellHtml: string): string | null => {
  const href = teamCellHtml.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
  if (!href) return null;

  const match = href.match(/salary-cap(?:-space)?\/([a-z0-9-]+)/i);
  if (match?.[1]) return normalizeTeamSlug(match[1]);

  const pathPart = href.split('/').filter(Boolean).at(-1);
  return pathPart ? normalizeTeamSlug(pathPart) : null;
};

const getCapTableHtml = (html: string): string | null => {
  const tableMatches = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi));

  for (const match of tableMatches) {
    const tableHtml = match[1] ?? '';
    const headers = Array.from(tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((entry) =>
      stripTags(entry[1] ?? '').toLowerCase(),
    );

    if (headers.length === 0) continue;

    const hasTeamHeader = headers.some((header) => header.includes('team'));
    const hasCapHeader = headers.some(
      (header) =>
        header.includes('cap space') ||
        header.includes('effective cap') ||
        header.includes('total cap liabilities') ||
        header.includes('total cap spending'),
    );

    if (hasTeamHeader && hasCapHeader) {
      return tableHtml;
    }
  }

  return null;
};

const parseRows = (html: string): TeamCapSourceRecord[] => {
  const tableHtml = getCapTableHtml(html);
  if (!tableHtml) return [];

  const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  const result: TeamCapSourceRecord[] = [];

  for (const match of rows) {
    const rowHtml = match[1] ?? '';
    const cellMatches = Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi));
    const cells = cellMatches.map((entry) => stripTags(entry[1] ?? ''));

    if (cells.length < 4) continue;

    const teamCell = cells[0] ?? '';
    if (!teamCell || teamCell.toLowerCase() === 'team') continue;

    const teamCellHtml = cellMatches[0]?.[1] ?? '';
    const teamSlug = getTeamSlug(teamCellHtml);

    result.push({
      teamName: teamCell,
      teamSlug,
      normalizedTeamName: normalizeTeamName(teamCell),
      capSpace: parseCurrency(cells[1] ?? ''),
      effectiveCapSpace: parseCurrency(cells[2] ?? ''),
      totalCapSpending: parseCurrency(cells[3] ?? ''),
      deadCap: parseCurrency(cells[4] ?? ''),
    });
  }

  return result;
};

const resolveTeamAbbr = (row: TeamCapSourceRecord): string | null => {
  const fromAlias = TEAM_ALIAS_TO_ABBR[row.normalizedTeamName];
  if (fromAlias) return fromAlias;

  const trimmed = row.teamName.trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(trimmed)) {
    const fromAbbr = NFL_TEAM_SEED.find((team) => team.abbreviation === trimmed);
    if (fromAbbr) return fromAbbr.abbreviation;
  }

  if (row.teamSlug) {
    const normalizedSlug = normalizeTeamSlug(row.teamSlug);
    const fromSlug = NFL_TEAM_SEED.find((team) => normalizeTeamSlug(team.name) === normalizedSlug);
    if (fromSlug) return fromSlug.abbreviation;
  }

  return null;
};

const retainCurrentYearRows = (rows: TeamCapSourceRecord[]): TeamCapSourceRecord[] => {
  const capMap = new Map<string, TeamCapSourceRecord>();
  const unmatched = new Set<string>();
  let mappedRowCount = 0;

  for (const row of rows) {
    const teamAbbr = resolveTeamAbbr(row);
    if (!teamAbbr) {
      unmatched.add(row.teamName);
      continue;
    }

    mappedRowCount += 1;

    if (!capMap.has(teamAbbr)) {
      capMap.set(teamAbbr, row);
    }

    if (capMap.size >= NFL_TEAM_SEED.length) {
      break;
    }
  }

  console.info(`[cap] total rows parsed: ${rows.length}`);
  console.info(`[cap] mapped rows: ${mappedRowCount}`);
  console.info(`[cap] unique teams captured: ${capMap.size}`);
  console.info(`[cap] unmatched: ${unmatched.size}`);
  if (unmatched.size > 0) {
    console.info(`[cap] unmatched team names: ${Array.from(unmatched).join(', ')}`);
  }

  return Array.from(capMap.values());
};

const buildHtmlSnippet = (html: string) => {
  const marker = html.toLowerCase().indexOf('salary cap');
  if (marker >= 0) {
    return html.slice(Math.max(0, marker - 400), marker + 1200);
  }
  return html.slice(0, 1600);
};

export const fetchTeamCap = async (): Promise<TeamCapSourceRecord[]> => {
  await sleep(250);
  const response = await fetch(OVER_THE_CAP_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nfl-manager-bot/1.0)' },
  });

  if (!response.ok) {
    throw new Error(`OverTheCap scrape failed (${response.status})`);
  }

  const html = await response.text();
  const rawRows = parseRows(html);
  const rows = retainCurrentYearRows(rawRows);
  if (rows.length === 0) {
    console.error('[cap] parser failed. html snippet:');
    console.error(buildHtmlSnippet(html));
    throw new Error('OverTheCap parser could not find any salary cap rows');
  }

  return rows;
};
