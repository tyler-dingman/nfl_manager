import { normalizePlayerName, normalizeTeamSlug } from '@/server/ingest/normalize';
import { NFL_TEAM_SEED } from '@/server/ingest/teams';

const OVER_THE_CAP_TEAM_CAP_URL = 'https://overthecap.com/salary-cap';
const REQUEST_DELAY_MS = 350;

export type TeamContractSourceRow = {
  teamSlug: string;
  teamAbbr: string;
  teamName: string;
  playerName: string;
  normalizedPlayerName: string;
  externalSourceKey: string | null;
  contractStatus: string | null;
  yearsRemaining: number | null;
  contractValue: number | null;
  averagePerYear: number | null;
  guaranteedMoney: number | null;
  fullyGuaranteedMoney: number | null;
  signingBonus: number | null;
  rosterBonus: number | null;
  workoutBonus: number | null;
  deadCap: number | null;
  releaseSavings: number | null;
  postJune1Savings: number | null;
  capHitCurrentYear: number | null;
  capHitFutureYears: Record<string, number> | null;
  baseSalary: number | null;
  rawContractPayload: Record<string, string | number | null>;
};

export type TeamContractSourceResult = {
  teamSlug: string;
  teamAbbr: string;
  teamName: string;
  rows: TeamContractSourceRow[];
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseMoney = (input: string | undefined): number | null => {
  const raw = (input ?? '').trim();
  if (!raw || raw === '-' || raw.toLowerCase() === 'n/a') return null;
  const negative = raw.includes('(') || raw.startsWith('-');
  const normalized = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return null;
  return negative ? -Math.round(parsed) : Math.round(parsed);
};

const parseInteger = (input: string | undefined): number | null => {
  const raw = (input ?? '').trim();
  if (!raw || raw === '-') return null;
  const parsed = Number.parseInt(raw.replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(parsed) ? null : parsed;
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

const normalizeHeader = (header: string) =>
  header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const findColumn = (headers: string[], tests: string[]) => {
  const candidates = headers.map((header, idx) => ({ idx, header: normalizeHeader(header) }));
  return candidates.find((candidate) => tests.some((test) => candidate.header.includes(test)))?.idx;
};

const parseCapHitFutureYears = (headers: string[], cells: string[]): Record<string, number> | null => {
  const future: Record<string, number> = {};
  headers.forEach((header, idx) => {
    const yearMatch = header.match(/\b(20\d{2})\b/);
    if (!yearMatch) return;
    const amount = parseMoney(cells[idx]);
    if (amount !== null) {
      future[yearMatch[1]] = amount;
    }
  });
  return Object.keys(future).length > 0 ? future : null;
};

const getTeamMeta = (teamAbbrOrSlug: string) => {
  const query = teamAbbrOrSlug.trim();
  const fromAbbr = NFL_TEAM_SEED.find((team) => team.abbreviation.toLowerCase() === query.toLowerCase());
  if (fromAbbr) {
    return { teamAbbr: fromAbbr.abbreviation, teamName: fromAbbr.name, teamSlug: normalizeTeamSlug(fromAbbr.name) };
  }

  const normalizedSlug = normalizeTeamSlug(query);
  const fromSlug = NFL_TEAM_SEED.find((team) => normalizeTeamSlug(team.name) === normalizedSlug);
  if (fromSlug) {
    return { teamAbbr: fromSlug.abbreviation, teamName: fromSlug.name, teamSlug: normalizedSlug };
  }

  return null;
};

const parseContractRows = (html: string, teamSlug: string, teamAbbr: string, teamName: string): TeamContractSourceRow[] => {
  const tableMatches = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi));

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1] ?? '';
    const headers = Array.from(tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((match) => stripTags(match[1] ?? ''));
    if (headers.length === 0) continue;

    const playerIdx = findColumn(headers, ['player']);
    if (playerIdx === undefined) continue;

    const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    const parsedRows: TeamContractSourceRow[] = [];

    const contractStatusIdx = findColumn(headers, ['status']);
    const yearsRemainingIdx = findColumn(headers, ['years left', 'years remaining', 'yrs']);
    const contractValueIdx = findColumn(headers, ['total value', 'contract value']);
    const averagePerYearIdx = findColumn(headers, ['average', 'apy', 'avg year']);
    const guaranteedMoneyIdx = findColumn(headers, ['guaranteed']);
    const fullyGuaranteedMoneyIdx = findColumn(headers, ['full guarantee', 'fully guaranteed']);
    const signingBonusIdx = findColumn(headers, ['signing bonus']);
    const rosterBonusIdx = findColumn(headers, ['roster bonus']);
    const workoutBonusIdx = findColumn(headers, ['workout bonus']);
    const deadCapIdx = findColumn(headers, ['dead cap']);
    const releaseSavingsIdx = findColumn(headers, ['release savings', 'cap savings']);
    const postJune1SavingsIdx = findColumn(headers, ['post june 1']);
    const capHitCurrentYearIdx = findColumn(headers, ['cap hit', 'current cap']);
    const baseSalaryIdx = findColumn(headers, ['base salary']);

    for (const rowMatch of rows) {
      const rowHtml = rowMatch[1] ?? '';
      const cellMatches = Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi));
      const cells = cellMatches.map((match) => stripTags(match[1] ?? ''));
      if (cells.length <= playerIdx) continue;

      const rawPlayer = cells[playerIdx] ?? '';
      if (!rawPlayer || normalizeHeader(rawPlayer) === 'player') continue;

      const playerLink = rowHtml.match(/href="([^"]+)"/i)?.[1] ?? null;

      const rawContractPayload: Record<string, string | number | null> = {};
      headers.forEach((header, idx) => {
        rawContractPayload[header] = cells[idx] ?? null;
      });

      parsedRows.push({
        teamSlug,
        teamAbbr,
        teamName,
        playerName: rawPlayer,
        normalizedPlayerName: normalizePlayerName(rawPlayer),
        externalSourceKey: playerLink,
        contractStatus: contractStatusIdx === undefined ? null : cells[contractStatusIdx] || null,
        yearsRemaining: yearsRemainingIdx === undefined ? null : parseInteger(cells[yearsRemainingIdx]),
        contractValue: contractValueIdx === undefined ? null : parseMoney(cells[contractValueIdx]),
        averagePerYear: averagePerYearIdx === undefined ? null : parseMoney(cells[averagePerYearIdx]),
        guaranteedMoney: guaranteedMoneyIdx === undefined ? null : parseMoney(cells[guaranteedMoneyIdx]),
        fullyGuaranteedMoney: fullyGuaranteedMoneyIdx === undefined ? null : parseMoney(cells[fullyGuaranteedMoneyIdx]),
        signingBonus: signingBonusIdx === undefined ? null : parseMoney(cells[signingBonusIdx]),
        rosterBonus: rosterBonusIdx === undefined ? null : parseMoney(cells[rosterBonusIdx]),
        workoutBonus: workoutBonusIdx === undefined ? null : parseMoney(cells[workoutBonusIdx]),
        deadCap: deadCapIdx === undefined ? null : parseMoney(cells[deadCapIdx]),
        releaseSavings: releaseSavingsIdx === undefined ? null : parseMoney(cells[releaseSavingsIdx]),
        postJune1Savings: postJune1SavingsIdx === undefined ? null : parseMoney(cells[postJune1SavingsIdx]),
        capHitCurrentYear: capHitCurrentYearIdx === undefined ? null : parseMoney(cells[capHitCurrentYearIdx]),
        capHitFutureYears: parseCapHitFutureYears(headers, cells),
        baseSalary: baseSalaryIdx === undefined ? null : parseMoney(cells[baseSalaryIdx]),
        rawContractPayload,
      });
    }

    if (parsedRows.length > 0) {
      return parsedRows;
    }
  }

  return [];
};

export const fetchTeamContracts = async (teamAbbrOrSlug: string): Promise<TeamContractSourceResult> => {
  const meta = getTeamMeta(teamAbbrOrSlug);
  if (!meta) {
    throw new Error(`Could not resolve team metadata for ${teamAbbrOrSlug}`);
  }

  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(`${OVER_THE_CAP_TEAM_CAP_URL}/${meta.teamSlug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nfl-manager-bot/1.0)' },
  });

  if (!response.ok) {
    throw new Error(`OverTheCap contract scrape failed for ${meta.teamAbbr} (${response.status})`);
  }

  const html = await response.text();
  const rows = parseContractRows(html, meta.teamSlug, meta.teamAbbr, meta.teamName);
  if (rows.length === 0) {
    throw new Error(`OverTheCap parser found zero contract rows for ${meta.teamAbbr}`);
  }

  return { ...meta, rows };
};

export const fetchAllTeamContracts = async (): Promise<TeamContractSourceResult[]> => {
  const results: TeamContractSourceResult[] = [];

  for (const team of NFL_TEAM_SEED) {
    const teamSlug = normalizeTeamSlug(team.name);
    try {
      const data = await fetchTeamContracts(team.abbreviation);
      results.push(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[contracts] scrape failed for ${team.abbreviation} (${teamSlug}): ${message}`);
      results.push({
        teamSlug,
        teamAbbr: team.abbreviation,
        teamName: team.name,
        rows: [],
        error: message,
      });
    }
  }

  return results;
};
