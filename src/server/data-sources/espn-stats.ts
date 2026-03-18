import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName } from '@/server/ingest/normalize';

export type TeamPlayerStatsRecord = {
  playerId?: string;
  playerName: string;
  teamAbbr?: string;
  position?: string;
  stats: UnifiedPlayerStats;
};

type TeamRosterPlayer = {
  id: string;
  name: string;
  teamAbbr?: string;
  position?: string;
};

const ESPN_STATS_URLS = {
  passing: 'https://www.espn.com/nfl/stats/player/_/table/passing/sort/passingYards/dir/desc',
  rushing: 'https://www.espn.com/nfl/stats/player/_/table/rushing/sort/rushingYards/dir/desc',
  receiving:
    'https://www.espn.com/nfl/stats/player/_/table/receiving/sort/receivingYards/dir/desc',
  defensive:
    'https://www.espn.com/nfl/stats/player/_/table/defensive/sort/totalTackles/dir/desc',
} as const;

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const stripTags = (value: string): string =>
  decodeEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeComparableName = (value: string) =>
  normalizePlayerName(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasNonEmptyStats = (stats: UnifiedPlayerStats) => Object.keys(stats).length > 0;

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; nfl-manager-sync/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
};

const extractRows = (html: string): string[][] =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
    [...(rowMatch[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      stripTags(cellMatch[1] ?? ''),
    ),
  );

const parseNameRows = (rows: string[][]) => {
  return rows
    .filter(
      (cells) =>
        cells.length === 2 &&
        /^\d+$/.test(cells[0] ?? '') &&
        / [A-Z]{2,3}(?:\/[A-Z]{2,3})?$/.test(cells[1] ?? ''),
    )
    .map((cells) => {
      const raw = cells[1];
      const match = raw.match(/^(.*)\s+([A-Z]{2,3}(?:\/[A-Z]{2,3})?)$/);
      if (!match) {
        return null;
      }

      return {
        playerName: match[1].trim(),
        teamAbbr: match[2].trim().split('/')[0],
      };
    })
    .filter((entry): entry is { playerName: string; teamAbbr: string } => Boolean(entry));
};

const isStatHeaderRow = (cells: string[]) =>
  cells.length >= 5 &&
  cells[0] === 'POS' &&
  cells.some((cell) => ['YDS', 'TD', 'REC', 'SACKS', 'TOT', 'CMP%'].includes(cell));

const isStatDataRow = (cells: string[], expectedLength: number) =>
  cells.length === expectedLength &&
  /^[A-Z]{1,5}$/.test(cells[0] ?? '') &&
  /^\d+$/.test(cells[1] ?? '');

const toNumber = (value: string) => {
  const normalized = value.replace(/,/g, '').replace(/%$/, '').trim();
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapStatsFromHeaders = (headers: string[], values: string[]): UnifiedPlayerStats => {
  const stats: UnifiedPlayerStats = {};

  headers.forEach((header, index) => {
    const key = header.trim().toUpperCase();
    const rawValue = values[index];
    const value = toNumber(rawValue);
    if (value === undefined) return;

    if (key === 'CMP%') stats.completionPct = value;
    else if (key === 'YDS') {
      // Use context-sensitive assignment later if needed; here we fill by surrounding headers
    } else if (key === 'TD') {
      // handled below contextually
    } else if (key === 'INT') {
      // passing INT or defensive INT handled below contextually
    } else if (key === 'AVG') {
      // rushing/receiving avg handled below contextually
    } else if (key === 'REC') stats.receptions = value;
    else if (key === 'TOT') stats.tackles = value;
    else if (key === 'SACKS') stats.sacks = value;
    else if (key === 'TFL') stats.tfl = value;
    else if (key === 'QBH') stats.qbHits = value;
    else if (key === 'PD') stats.passDeflections = value;
    else if (key === 'FF') stats.forcedFumbles = value;
  });

  const joinedHeaders = headers.join('|');

  headers.forEach((header, index) => {
    const key = header.trim().toUpperCase();
    const value = toNumber(values[index]);
    if (value === undefined) return;

    if (key === 'YDS') {
      if (joinedHeaders.includes('CMP%')) stats.passingYards = value;
      else if (joinedHeaders.includes('REC')) stats.recYards = value;
      else stats.rushYards = value;
    }

    if (key === 'TD') {
      if (joinedHeaders.includes('CMP%')) stats.passingTD = value;
      else if (joinedHeaders.includes('REC')) stats.recTD = value;
      else stats.rushTD = value;
    }

    if (key === 'INT') {
      if (joinedHeaders.includes('CMP%')) stats.interceptions = value;
      else stats.interceptionsDef = value;
    }

    if (key === 'AVG') {
      if (joinedHeaders.includes('REC')) stats.yardsPerCatch = value;
      else if (joinedHeaders.includes('ATT')) stats.yardsPerCarry = value;
    }
  });

  return stats;
};

const parseCategoryPage = (html: string, category: keyof typeof ESPN_STATS_URLS) => {
  const rows = extractRows(html);

  const nameRows = parseNameRows(rows);

  const headerIndex = rows.findIndex(isStatHeaderRow);
  if (headerIndex === -1) {
    return [];
  }

  const statHeader = rows[headerIndex];
  const statRows: string[][] = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (isStatDataRow(cells, statHeader.length)) {
      statRows.push(cells);
      continue;
    }

    if (statRows.length > 0) {
      break;
    }
  }

  console.log(
    `[sync:players:debug] ${category} nameRows=${nameRows.length} statRows=${statRows.length} header=${JSON.stringify(statHeader)}`,
  );

  const zippedCount = Math.min(nameRows.length, statRows.length);
  const records: TeamPlayerStatsRecord[] = [];

  for (let i = 0; i < zippedCount; i += 1) {
    const identity = nameRows[i];
    const statRow = statRows[i];
    const stats = mapStatsFromHeaders(statHeader, statRow);

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName: identity.playerName,
      teamAbbr: identity.teamAbbr,
      position: statRow[0],
      stats,
    });
  }

  console.log(
    `[sync:players:debug] ${category} zipped=${zippedCount} usable=${records.length} sample=${JSON.stringify(records.slice(0, 3))}`,
  );

  return records;
};

const mergeRecords = (records: TeamPlayerStatsRecord[]) => {
  const merged = new Map<string, TeamPlayerStatsRecord>();

  for (const record of records) {
    const key = `${normalizeComparableName(record.playerName)}:${record.teamAbbr ?? ''}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...record,
        stats: { ...record.stats },
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      stats: {
        ...existing.stats,
        ...record.stats,
      },
    });
  }

  return Array.from(merged.values());
};

export const fetchTeamStats = async (
  teamId: string,
  rosterPlayers: TeamRosterPlayer[],
): Promise<TeamPlayerStatsRecord[]> => {
  const rosterNames = new Set(rosterPlayers.map((player) => normalizeComparableName(player.name)));
  const rosterAbbr = rosterPlayers[0]?.teamAbbr;

  const pages = await Promise.all(
    Object.entries(ESPN_STATS_URLS).map(async ([category, url]) => {
      try {
        const html = await fetchHtml(url);
        return { category: category as keyof typeof ESPN_STATS_URLS, html };
      } catch {
        return { category: category as keyof typeof ESPN_STATS_URLS, html: '' };
      }
    }),
  );

  const parsed = pages.flatMap(({ category, html }) => {
    if (!html) return [];
    return parseCategoryPage(html, category);
  });

  const filtered = parsed.filter((record) => {
    const normalizedName = normalizeComparableName(record.playerName);
    if (!rosterNames.has(normalizedName)) return false;
    if (rosterAbbr && record.teamAbbr && rosterAbbr !== record.teamAbbr) return false;
    return hasNonEmptyStats(record.stats);
  });

  const merged = mergeRecords(filtered);

  console.log(
    `[sync:players:debug] team=${teamId} parsed=${parsed.length} filtered=${filtered.length} merged=${merged.length}`,
  );

  return merged;
};
