import { normalizeTeamName } from '@/server/ingest/normalize';

const OVER_THE_CAP_URL = 'https://overthecap.com/salary-cap-space';

export type TeamCapSourceRecord = {
  teamName: string;
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

const stripTags = (value: string) => decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

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

const parseRows = (html: string): TeamCapSourceRecord[] => {
  const rows = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  const result: TeamCapSourceRecord[] = [];

  for (const match of rows) {
    const rowHtml = match[1] ?? '';
    const cells = Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((entry) =>
      stripTags(entry[1] ?? ''),
    );

    if (cells.length < 2) continue;
    const teamCell = cells[0] ?? '';
    if (!teamCell || teamCell.toLowerCase() === 'team') continue;

    result.push({
      teamName: teamCell,
      normalizedTeamName: normalizeTeamName(teamCell),
      capSpace: parseCurrency(cells[1] ?? ''),
      effectiveCapSpace: parseCurrency(cells[2] ?? ''),
      totalCapSpending: parseCurrency(cells[3] ?? ''),
      deadCap: parseCurrency(cells[4] ?? ''),
    });
  }

  return result;
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
  const rows = parseRows(html);
  if (rows.length === 0) {
    throw new Error('OverTheCap parser could not find any salary cap rows');
  }

  return rows;
};
