import {
  normalizePlayerName,
  normalizeTeamName,
  normalizeTeamSlug,
} from '@/server/ingest/normalize';
import { TEAM_ALIAS_TO_ABBR, NFL_TEAM_SEED } from '@/server/ingest/teams';

const MADDEN_BASE_URL = 'https://www.maddenratings.com';

export type MaddenRatingRecord = {
  playerName: string;
  team: string;
  position: string;
  overallRating: number;
};

export const normalizeFootballPosition = (value: string): string => {
  const normalized = value.trim().toUpperCase();

  if (['LT', 'RT', 'T', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'G', 'OL', 'IOL'].includes(normalized)) return 'IOL';
  if (normalized === 'C') return 'C';
  if (['LE', 'RE', 'DE'].includes(normalized)) return 'DE';
  if (['LOLB', 'ROLB', 'MLB', 'ILB', 'OLB', 'LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  if (['DT', 'NT'].includes(normalized)) return 'DT';

  return normalized;
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

  const isLikelyPlayerName = (value: string) => {
    const cleaned = decodeEntities(stripTags(value)).trim();
    if (!cleaned) return false;
    if (/^image:/i.test(cleaned)) return false;
    if (/^(united states|greece|canada|australia)$/i.test(cleaned)) return false;
    if (
      /^(qb|rb|hb|fb|wr|te|lt|lg|c|rg|rt|ol|dt|nt|de|le|re|edge|ledg|redg|lb|mlb|ilb|olb|lolb|rolb|mike|sam|will|cb|fs|ss|s|k|p)$/i.test(
        cleaned,
      )
    ) {
      return false;
    }
    if (/^\d+\.?$/.test(cleaned)) return false;
    return /[A-Za-z]/.test(cleaned) && cleaned.includes(' ');
  };

  for (const rowMatch of html.matchAll(rowRegex)) {
    const rowHtml = rowMatch[1] ?? '';
    const rowText = decodeEntities(stripTags(rowHtml)).replace(/\s+/g, ' ').trim();

    if (!rowText) continue;

    // Pull candidate anchor texts from the row
    const anchorTexts = [...rowHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => decodeEntities(stripTags(match[1] ?? '')).trim())
      .filter(Boolean);

    const playerName = anchorTexts.find(isLikelyPlayerName) ?? '';

    // Position usually appears like "#15 QB | Improviser"
    const positionMatch = rowText.match(/#\d+\s+([A-Z]{1,5})\s+\|/i);
    const position = (positionMatch?.[1] ?? '').toUpperCase();

    // OVR is the first 2-digit number after the position/archetype block
    const ratingBlockMatch = rowText.match(
      /#\d+\s+[A-Z]{1,5}\s+\|[^0-9]*?(\d{2})\s+\d{2}\s+[\d,]+/i,
    );
    const overallRating = Number.parseInt(ratingBlockMatch?.[1] ?? '', 10);

    if (!playerName || !position || !Number.isFinite(overallRating)) {
      continue;
    }

    records.push({
      playerName,
      team: fallbackTeamName,
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
    TEAM_ALIAS_TO_ABBR[normalized] ?? TEAM_ALIAS_TO_ABBR[normalized.replace(/\bnfl\b/g, '').trim()]
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
  position: normalizeFootballPosition(position),
});
