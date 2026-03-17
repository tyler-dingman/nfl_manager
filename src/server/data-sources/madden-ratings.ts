import { normalizePlayerName, normalizeTeamName, normalizeTeamSlug } from '@/server/ingest/normalize';
import { TEAM_ALIAS_TO_ABBR, NFL_TEAM_SEED } from '@/server/ingest/teams';

const MADDEN_BASE_URL = 'https://www.maddenratings.com';

export type MaddenRatingRecord = {
  playerName: string;
  team: string;
  position: string;
  overallRating: number;
};

const stripTags = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const parseRows = (html: string, fallbackTeamName: string): MaddenRatingRecord[] => {
  const records: MaddenRatingRecord[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const row = rowMatch[1] ?? '';
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      decodeEntities(stripTags(cellMatch[1] ?? '')),
    );

    if (cells.length < 3) {
      continue;
    }

    const numericCells = cells
      .map((cell) => Number.parseInt(cell, 10))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 99);

    if (numericCells.length === 0) {
      continue;
    }

    const overallRating = numericCells[0] ?? Number.NaN;
    if (!Number.isFinite(overallRating)) {
      continue;
    }

    // Try common table layouts:
    // [name, position, overall]
    // [name, team, position, overall]
    // [rank, name, position, overall]
    let playerName = '';
    let team = fallbackTeamName;
    let position = '';

    if (cells.length >= 4) {
      // Most likely [player, team, position, overall] or [rank, player, position, overall]
      if (/^[A-Z]{1,4}$/.test(cells[2] ?? '')) {
        playerName = cells[1] ?? '';
        position = cells[2] ?? '';
        team = fallbackTeamName;
      } else {
        playerName = cells[0] ?? '';
        team = cells[1] ?? fallbackTeamName;
        position = cells[2] ?? '';
      }
    } else if (cells.length === 3) {
      playerName = cells[0] ?? '';
      position = cells[1] ?? '';
      team = fallbackTeamName;
    }

    playerName = playerName.trim();
    position = position.trim().toUpperCase();
    team = team.trim() || fallbackTeamName;

    if (!playerName || !position) {
      continue;
    }

    // Skip obvious header rows
    if (
      /player|name|team|position|ovr|overall/i.test(playerName) ||
      /player|name|team|position|ovr|overall/i.test(position)
    ) {
      continue;
    }

    records.push({
      playerName,
      team,
      position,
      overallRating,
    });
  }

  return records;
};

const fetchTeamPage = async (teamName: string): Promise<string> => {
  const slug = normalizeTeamSlug(teamName);
  const url = `${MADDEN_BASE_URL}/teams/${slug}`;

  console.info(`[madden] fetching ${url}`);

  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; nfl-manager-sync/1.0)',
    },
  });

  console.info(`[madden] ${url} -> ${response.status}`);

  if (!response.ok) {
    throw new Error(`Madden team page fetch failed (${response.status}) for ${url}`);
  }

  const html = await response.text();
  console.info(`[madden] html length for ${teamName}: ${html.length}`);
  return html;
};

export const normalizeMaddenTeamToAbbr = (team: string): string | undefined => {
  const normalized = normalizeTeamName(team);
  return (
    TEAM_ALIAS_TO_ABBR[normalized] ??
    TEAM_ALIAS_TO_ABBR[normalized.replace(/\bnfl\b/g, '').trim()]
  );
};

export const fetchMaddenRatings = async (): Promise<MaddenRatingRecord[]> => {
  const records: MaddenRatingRecord[] = [];

  for (const team of NFL_TEAM_SEED) {
    try {
      const html = await fetchTeamPage(team.name);
      const teamRows = parseRows(html, team.name);
      console.info(`[madden] parsed ${teamRows.length} rows for ${team.abbreviation}`);
      records.push(...teamRows);
    } catch (error) {
      console.warn(
        `[madden] failed for ${team.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  if (records.length === 0) {
    throw new Error('Madden ratings scraper returned zero rows');
  }

  return records;
};

export const buildMaddenPlayerKey = ({
  playerName,
  team,
  position,
}: {
  playerName: string;
  team: string;
  position: string;
}): { normalizedName: string; teamAbbr?: string; position: string } => ({
  normalizedName: normalizePlayerName(playerName),
  teamAbbr: normalizeMaddenTeamToAbbr(team),
  position: position.trim().toUpperCase(),
});