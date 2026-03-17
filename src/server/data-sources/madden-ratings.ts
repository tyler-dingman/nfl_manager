import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';
import { TEAM_ALIAS_TO_ABBR } from '@/server/ingest/teams';

const MADDEN_RATINGS_URL = 'https://www.maddenratings.com/ratings';

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

const parseRows = (html: string): MaddenRatingRecord[] => {
  const records: MaddenRatingRecord[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const row = rowMatch[1] ?? '';
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      decodeEntities(stripTags(cellMatch[1] ?? '')),
    );

    if (cells.length < 4) {
      continue;
    }

    const maybeRating = Number.parseInt(cells.at(-1) ?? '', 10);
    if (!Number.isFinite(maybeRating) || maybeRating < 1 || maybeRating > 99) {
      continue;
    }

    const [playerName, team, position] = cells;
    if (!playerName || !team || !position) {
      continue;
    }

    records.push({
      playerName,
      team,
      position: position.toUpperCase(),
      overallRating: maybeRating,
    });
  }

  return records;
};

const parseEmbeddedJson = (html: string): MaddenRatingRecord[] => {
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  );
  if (!nextDataMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(nextDataMatch[1]) as {
      props?: { pageProps?: { ratings?: Array<Record<string, unknown>> } };
    };

    const rows = parsed.props?.pageProps?.ratings ?? [];
    return rows
      .map((row) => {
        const playerName = String(row.player ?? row.name ?? '').trim();
        const team = String(row.team ?? '').trim();
        const position = String(row.position ?? '')
          .trim()
          .toUpperCase();
        const overallRating = Number(row.overall ?? row.rating ?? Number.NaN);
        if (!playerName || !team || !position || !Number.isFinite(overallRating)) {
          return null;
        }

        return {
          playerName,
          team,
          position,
          overallRating,
        } satisfies MaddenRatingRecord;
      })
      .filter((entry): entry is MaddenRatingRecord => entry !== null);
  } catch {
    return [];
  }
};

export const normalizeMaddenTeamToAbbr = (team: string): string | undefined => {
  const normalized = normalizeTeamName(team);
  return (
    TEAM_ALIAS_TO_ABBR[normalized] ?? TEAM_ALIAS_TO_ABBR[normalized.replace(/\bnfl\b/g, '').trim()]
  );
};

export const fetchMaddenRatings = async (): Promise<MaddenRatingRecord[]> => {
  const response = await fetch(MADDEN_RATINGS_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; nfl-manager-sync/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Madden ratings fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const embedded = parseEmbeddedJson(html);
  if (embedded.length > 0) {
    return embedded;
  }

  return parseRows(html);
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
