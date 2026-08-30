import https from 'node:https';

import { normalizePlayerName } from '@/server/ingest/normalize';

const getPffBigBoardUrl = (year: number) =>
  `https://www.pff.com/news/draft-${year}-nfl-draft-big-board`;
const getMockDraftDatabaseBigBoardUrl = (year: number) =>
  `https://www.nflmockdraftdatabase.com/big-boards/${year}/consensus-big-board-${year}`;

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

export type ExternalDraftRankingRecord = {
  ranking: number | null;
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  source: 'pff' | 'consensus';
};

type MockDraftDatabaseConsensusPayload = {
  mock?: {
    selections?: Array<{
      pick?: number;
      player?: {
        name?: string;
        position?: string;
        college?: {
          name?: string;
        };
      };
    }>;
  };
};

const requestText = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        agent: insecureAgent,
        headers: {
          Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Down & Distance Draft Sync)',
        },
      },
      (response) => {
        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`Request failed (${response.statusCode ?? 0}) for ${url}`));
          return;
        }
        const chunks: string[] = [];
        response.setEncoding('utf8');
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(chunks.join('')));
      },
    );
    request.on('error', reject);
    request.end();
  });

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const buildRecord = ({
  ranking,
  name,
  school,
  position,
  source,
}: {
  ranking: number | null;
  name: string;
  school: string | null;
  position: string | null;
  source: 'pff' | 'consensus';
}): ExternalDraftRankingRecord => ({
  ranking,
  name: name.trim(),
  normalizedName: normalizePlayerName(name),
  school: school?.trim() || null,
  position: position?.trim() || null,
  source,
});

export const fetchPffBigBoardRankings = async (
  year = 2026,
): Promise<ExternalDraftRankingRecord[]> => {
  const html = await requestText(getPffBigBoardUrl(year));
  const matches = html.matchAll(
    /<h3 class="wp-block-heading">(\d+)\.\s*([A-Z/+-]+)\s+(.+?),\s*([^<]+)<\/h3>/g,
  );

  const seen = new Set<string>();
  const rankings: ExternalDraftRankingRecord[] = [];
  for (const match of matches) {
    const ranking = Number.parseInt(match[1] ?? '', 10);
    const position = match[2] ?? null;
    const name = match[3]?.trim() ?? '';
    const school = match[4]?.trim() ?? null;
    if (!name || !Number.isFinite(ranking)) {
      continue;
    }

    const key = `${normalizePlayerName(name)}:${ranking}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rankings.push(
      buildRecord({
        ranking,
        name,
        school,
        position,
        source: 'pff',
      }),
    );
  }

  if (rankings.length === 0) {
    throw new Error('Unable to parse PFF big board rankings');
  }

  return rankings;
};

const extractMockDraftDatabasePayload = (html: string): MockDraftDatabaseConsensusPayload => {
  const match = html.match(/data-react-props="([^"]+)"/);
  if (!match?.[1]) {
    throw new Error('Unable to locate NFL Mock Draft Database consensus payload');
  }

  return JSON.parse(decodeHtmlEntities(match[1])) as MockDraftDatabaseConsensusPayload;
};

export const fetchConsensusBigBoardRankings = async (
  year = 2026,
): Promise<ExternalDraftRankingRecord[]> => {
  const html = await requestText(getMockDraftDatabaseBigBoardUrl(year));
  const payload = extractMockDraftDatabasePayload(html);
  const selections = payload.mock?.selections ?? [];

  const rankings = selections
    .map((selection) => {
      const ranking = selection.pick ?? null;
      const name = selection.player?.name?.trim() ?? '';
      if (!name) {
        return null;
      }
      return buildRecord({
        ranking,
        name,
        school: selection.player?.college?.name?.trim() ?? null,
        position: selection.player?.position?.trim() ?? null,
        source: 'consensus',
      });
    })
    .filter((entry): entry is ExternalDraftRankingRecord => Boolean(entry));

  if (rankings.length === 0) {
    throw new Error('Unable to parse NFL Mock Draft Database consensus board');
  }

  return rankings;
};
