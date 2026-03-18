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

type ParsedCell = {
  text: string;
  colspan: number;
  rowspan: number;
};

const parseCellAttributes = (attrs: string): { colspan: number; rowspan: number } => {
  const colspanMatch = attrs.match(/colspan=["']?(\d+)["']?/i);
  const rowspanMatch = attrs.match(/rowspan=["']?(\d+)["']?/i);
  return {
    colspan: Math.max(1, Number.parseInt(colspanMatch?.[1] ?? '1', 10) || 1),
    rowspan: Math.max(1, Number.parseInt(rowspanMatch?.[1] ?? '1', 10) || 1),
  };
};

const parseCellsFromRow = (rowHtml: string, tag: 'th' | 'td'): ParsedCell[] =>
  Array.from(rowHtml.matchAll(new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi'))).map(
    (match) => {
      const attrs = parseCellAttributes(match[1] ?? '');
      return {
        text: stripTags(match[2] ?? ''),
        colspan: attrs.colspan,
        rowspan: attrs.rowspan,
      };
    },
  );

const resolveHeaders = (headerRows: ParsedCell[][]): string[] => {
  const grid: string[][] = [];
  let maxColumn = 0;

  headerRows.forEach((rowCells, rowIdx) => {
    let colIdx = 0;
    grid[rowIdx] ??= [];

    for (const cell of rowCells) {
      while (grid[rowIdx]?.[colIdx]) {
        colIdx += 1;
      }

      for (let rowOffset = 0; rowOffset < cell.rowspan; rowOffset += 1) {
        const targetRow = rowIdx + rowOffset;
        grid[targetRow] ??= [];
        for (let colOffset = 0; colOffset < cell.colspan; colOffset += 1) {
          grid[targetRow][colIdx + colOffset] = cell.text;
          maxColumn = Math.max(maxColumn, colIdx + colOffset + 1);
        }
      }

      colIdx += cell.colspan;
    }
  });

  return Array.from({ length: maxColumn }, (_, idx) => {
    const parts: string[] = [];
    for (let rowIdx = 0; rowIdx < grid.length; rowIdx += 1) {
      const value = (grid[rowIdx]?.[idx] ?? '').trim();
      if (!value) continue;
      if (parts.at(-1) !== value) {
        parts.push(value);
      }
    }
    return parts.join(' ').trim() || `Column ${idx + 1}`;
  });
};

const expandDataCells = (rowCells: ParsedCell[]): string[] => {
  const expanded: string[] = [];
  for (const cell of rowCells) {
    expanded.push(cell.text);
    for (let i = 1; i < cell.colspan; i += 1) {
      expanded.push('');
    }
  }
  return expanded;
};

const findColumn = (headers: string[], tests: string[]) => {
  const candidates = headers.map((header, idx) => ({ idx, header: normalizeHeader(header) }));
  return candidates.find((candidate) => tests.some((test) => candidate.header.includes(test)))?.idx;
};

const findCapHitColumn = (headers: string[]): number | undefined => {
  const currentYear = new Date().getUTCFullYear();
  const candidates = headers
    .map((header, idx) => ({ idx, normalized: normalizeHeader(header), header }))
    .filter(({ normalized }) => {
      const isCapMetric =
        normalized.includes('cap hit') ||
        normalized.includes('current cap') ||
        normalized.includes('cap number') ||
        normalized.includes('cap charge');
      const isReleaseMetric =
        normalized.includes('dead cap') ||
        normalized.includes('release savings') ||
        normalized.includes('post june 1') ||
        normalized.includes('cap savings');
      return isCapMetric && !isReleaseMetric;
    })
    .map((entry) => {
      const year = entry.header.match(/\b(20\d{2})\b/)?.[1];
      return {
        ...entry,
        year: year ? Number.parseInt(year, 10) : null,
      };
    });

  if (candidates.length === 0) return undefined;

  const withYear = candidates
    .filter((candidate) => candidate.year !== null)
    .sort((a, b) => Math.abs((a.year ?? currentYear) - currentYear) - Math.abs((b.year ?? currentYear) - currentYear));
  if (withYear.length > 0) {
    return withYear[0]?.idx;
  }

  return candidates[0]?.idx;
};

const parseCapHitFutureYears = (
  headers: string[],
  cells: string[],
): Record<string, number> | null => {
  const future: Record<string, number> = {};
  headers.forEach((header, idx) => {
    const normalized = normalizeHeader(header);
    const yearMatch = header.match(/\b(20\d{2})\b/);
    if (!yearMatch) return;
    const isCapMetric =
      normalized.includes('cap hit') ||
      normalized.includes('cap number') ||
      normalized.includes('cap charge');
    const isReleaseMetric =
      normalized.includes('dead cap') ||
      normalized.includes('release savings') ||
      normalized.includes('post june 1') ||
      normalized.includes('cap savings');
    if (!isCapMetric || isReleaseMetric) return;
    const amount = parseMoney(cells[idx]);
    if (amount !== null) {
      future[yearMatch[1]] = amount;
    }
  });
  return Object.keys(future).length > 0 ? future : null;
};

const deriveYearsRemaining = (
  parsedYearsRemaining: number | null,
  capHitFutureYears: Record<string, number> | null,
): number | null => {
  if (parsedYearsRemaining !== null) {
    return parsedYearsRemaining;
  }
  if (!capHitFutureYears) {
    return null;
  }
  const currentYear = new Date().getUTCFullYear();
  const maxYear = Math.max(
    ...Object.keys(capHitFutureYears)
      .map((year) => Number.parseInt(year, 10))
      .filter((year) => Number.isFinite(year)),
  );
  if (!Number.isFinite(maxYear) || maxYear < currentYear) {
    return null;
  }
  return maxYear - currentYear + 1;
};

const resolveCurrentYearCapHit = (
  capHitCurrentYear: number | null,
  capHitFutureYears: Record<string, number> | null,
): number | null => {
  if (capHitCurrentYear !== null) {
    return capHitCurrentYear;
  }
  if (!capHitFutureYears) {
    return null;
  }

  const currentYear = new Date().getUTCFullYear();
  const entries = Object.entries(capHitFutureYears)
    .map(([year, value]) => ({ year: Number.parseInt(year, 10), value }))
    .filter((entry) => Number.isFinite(entry.year))
    .sort((a, b) => Math.abs(a.year - currentYear) - Math.abs(b.year - currentYear));

  return entries[0]?.value ?? null;
};

const getTeamMeta = (teamAbbrOrSlug: string) => {
  const query = teamAbbrOrSlug.trim();
  const fromAbbr = NFL_TEAM_SEED.find(
    (team) => team.abbreviation.toLowerCase() === query.toLowerCase(),
  );
  if (fromAbbr) {
    return {
      teamAbbr: fromAbbr.abbreviation,
      teamName: fromAbbr.name,
      teamSlug: normalizeTeamSlug(fromAbbr.name),
    };
  }

  const normalizedSlug = normalizeTeamSlug(query);
  const fromSlug = NFL_TEAM_SEED.find((team) => normalizeTeamSlug(team.name) === normalizedSlug);
  if (fromSlug) {
    return { teamAbbr: fromSlug.abbreviation, teamName: fromSlug.name, teamSlug: normalizedSlug };
  }

  return null;
};

const parseContractRows = (
  html: string,
  teamSlug: string,
  teamAbbr: string,
  teamName: string,
): TeamContractSourceRow[] => {
  const tableMatches = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi));

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1] ?? '';
    const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    const headerRows: ParsedCell[][] = [];
    const dataRowsHtml: string[] = [];

    for (const rowMatch of rows) {
      const rowHtml = rowMatch[1] ?? '';
      const thCells = parseCellsFromRow(rowHtml, 'th');
      const tdCells = parseCellsFromRow(rowHtml, 'td');
      if (thCells.length > 0 && tdCells.length === 0 && dataRowsHtml.length === 0) {
        headerRows.push(thCells);
        continue;
      }
      if (tdCells.length > 0) {
        dataRowsHtml.push(rowHtml);
      }
    }

    const headers = resolveHeaders(headerRows);
    if (headers.length === 0) continue;

    const playerIdx = findColumn(headers, ['player']);
    if (playerIdx === undefined) continue;
    const parsedRows: TeamContractSourceRow[] = [];
    let loggedRowSample = false;
    let loggedFutureCapSample = false;
    console.info(
      `[contracts:debug] resolved headers sample=${JSON.stringify(headers.slice(0, 12))}`,
    );

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
    const capHitCurrentYearIdx = findCapHitColumn(headers);
    const baseSalaryIdx = findColumn(headers, ['base salary']);

    for (const rowHtml of dataRowsHtml) {
      const cells = expandDataCells(parseCellsFromRow(rowHtml, 'td'));
      if (cells.length <= playerIdx) continue;

      const rawPlayer = cells[playerIdx] ?? '';
      if (!rawPlayer || normalizeHeader(rawPlayer) === 'player') continue;

      const playerLink = rowHtml.match(/href="([^"]+)"/i)?.[1] ?? null;

      const rawContractPayload: Record<string, string | number | null> = {};
      headers.forEach((header, idx) => {
        rawContractPayload[header] = cells[idx] ?? null;
      });

      const capHitFutureYears = parseCapHitFutureYears(headers, cells);
      const parsedCapHitCurrentYear =
        capHitCurrentYearIdx === undefined ? null : parseMoney(cells[capHitCurrentYearIdx]);
      const parsedYearsRemaining =
        yearsRemainingIdx === undefined ? null : parseInteger(cells[yearsRemainingIdx]);

      if (!loggedFutureCapSample && capHitFutureYears) {
        console.info(
          `[contracts:debug] future cap years sample=${JSON.stringify({
            player: rawPlayer,
            capHitFutureYears,
          })}`,
        );
        loggedFutureCapSample = true;
      }

      const parsedRow = {
        teamSlug,
        teamAbbr,
        teamName,
        playerName: rawPlayer,
        normalizedPlayerName: normalizePlayerName(rawPlayer),
        externalSourceKey: playerLink,
        contractStatus: contractStatusIdx === undefined ? null : cells[contractStatusIdx] || null,
        yearsRemaining: deriveYearsRemaining(parsedYearsRemaining, capHitFutureYears),
        contractValue: contractValueIdx === undefined ? null : parseMoney(cells[contractValueIdx]),
        averagePerYear:
          averagePerYearIdx === undefined ? null : parseMoney(cells[averagePerYearIdx]),
        guaranteedMoney:
          guaranteedMoneyIdx === undefined ? null : parseMoney(cells[guaranteedMoneyIdx]),
        fullyGuaranteedMoney:
          fullyGuaranteedMoneyIdx === undefined ? null : parseMoney(cells[fullyGuaranteedMoneyIdx]),
        signingBonus: signingBonusIdx === undefined ? null : parseMoney(cells[signingBonusIdx]),
        rosterBonus: rosterBonusIdx === undefined ? null : parseMoney(cells[rosterBonusIdx]),
        workoutBonus: workoutBonusIdx === undefined ? null : parseMoney(cells[workoutBonusIdx]),
        deadCap: deadCapIdx === undefined ? null : parseMoney(cells[deadCapIdx]),
        releaseSavings:
          releaseSavingsIdx === undefined ? null : parseMoney(cells[releaseSavingsIdx]),
        postJune1Savings:
          postJune1SavingsIdx === undefined ? null : parseMoney(cells[postJune1SavingsIdx]),
        capHitCurrentYear: resolveCurrentYearCapHit(parsedCapHitCurrentYear, capHitFutureYears),
        capHitFutureYears,
        baseSalary: baseSalaryIdx === undefined ? null : parseMoney(cells[baseSalaryIdx]),
        rawContractPayload,
      } satisfies TeamContractSourceRow;

      if (!loggedRowSample) {
        console.info(
          `[contracts:debug] parsed row sample=${JSON.stringify({
            player: parsedRow.playerName,
            yearsRemaining: parsedRow.yearsRemaining,
            rawSourceFields: parsedRow.rawContractPayload,
          })}`,
        );
        loggedRowSample = true;
      }

      parsedRows.push(parsedRow);
    }

    if (parsedRows.length > 0) {
      return parsedRows;
    }
  }

  return [];
};

export const fetchTeamContracts = async (
  teamAbbrOrSlug: string,
): Promise<TeamContractSourceResult> => {
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
