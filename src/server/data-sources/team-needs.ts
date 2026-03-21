type RawTeamNeedsRow = {
  pick?: string;
  sort?: string;
  player?: {
    name?: string | null;
    position?: string | null;
  };
};

type TeamNeedsPageProps = {
  teams?: RawTeamNeedsRow[];
};

export type TeamNeedsRecord = {
  teamAbbr: string;
  teamName: string;
  topNeeds: string[];
  allNeeds: string[];
};

const TEAM_NEEDS_URL = 'https://www.nflmockdraftdatabase.com/team-needs-2026';

const TEAM_ABBR_MAP: Record<string, string> = {
  ARI: 'ARI',
  ATL: 'ATL',
  BAL: 'BAL',
  BUF: 'BUF',
  CAR: 'CAR',
  CHI: 'CHI',
  CIN: 'CIN',
  CLE: 'CLE',
  DAL: 'DAL',
  DEN: 'DEN',
  DET: 'DET',
  GB: 'GB',
  GNB: 'GB',
  HOU: 'HOU',
  IND: 'IND',
  JAC: 'JAX',
  JAX: 'JAX',
  KC: 'KC',
  LAC: 'LAC',
  LAR: 'LAR',
  LV: 'LV',
  MIA: 'MIA',
  MIN: 'MIN',
  NE: 'NE',
  NO: 'NO',
  NYG: 'NYG',
  NYJ: 'NYJ',
  PHI: 'PHI',
  PIT: 'PIT',
  SEA: 'SEA',
  SF: 'SF',
  TB: 'TB',
  TEN: 'TEN',
  WAS: 'WAS',
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const dedupeInOrder = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export const normalizePosition = (rawPosition: string): string | null => {
  const normalized = rawPosition.trim().toUpperCase().replace(/\./g, '');
  if (!normalized) return null;

  if (['EDGE', 'ED', 'DE', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['OT', 'OL', 'T', 'TACKLE', 'LT', 'RT'].includes(normalized)) return 'OT';
  if (['IOL', 'G', 'GUARD', 'C', 'CENTER', 'LG', 'RG'].includes(normalized)) return 'IOL';
  if (['CB', 'CORNER', 'CORNERBACK'].includes(normalized)) return 'CB';
  if (['S', 'SAFETY', 'FS', 'SS'].includes(normalized)) return 'S';
  if (['DL', 'DT', 'NT', 'IDL'].includes(normalized)) return 'DL';
  if (['LB', 'MLB', 'ILB', 'OLB', 'LINEBACKER'].includes(normalized)) return 'LB';
  if (['WR', 'WIDE RECEIVER'].includes(normalized)) return 'WR';
  if (['QB', 'QUARTERBACK'].includes(normalized)) return 'QB';
  if (['RB', 'RUNNING BACK', 'HB', 'FB'].includes(normalized)) return 'RB';
  if (['TE', 'TIGHT END'].includes(normalized)) return 'TE';
  if (['K', 'KICKER'].includes(normalized)) return 'K';
  if (['P', 'PUNTER'].includes(normalized)) return 'P';

  return normalized;
};

const parseNeedList = (rawValue: string | null | undefined) =>
  dedupeInOrder(
    (rawValue ?? '')
      .split(',')
      .map((value) => normalizePosition(value))
      .filter((value): value is string => Boolean(value)),
  );

export const parseTeamNeedsHtml = (html: string): TeamNeedsRecord[] => {
  const match = html.match(/data-react-class="team_needs\/Index"[\s\S]*?data-react-props="([^"]+)"/i);
  if (!match?.[1]) {
    throw new Error('Unable to locate team needs payload in NFL Mock Draft Database page.');
  }

  const props = JSON.parse(decodeHtmlEntities(match[1])) as TeamNeedsPageProps;
  const rows = props.teams ?? [];

  return rows
    .map((row) => {
      const rawAbbr = row.pick?.trim().toUpperCase() ?? '';
      const teamAbbr = TEAM_ABBR_MAP[rawAbbr] ?? rawAbbr;
      const allNeeds = dedupeInOrder([
        ...parseNeedList(row.player?.name),
        ...parseNeedList(row.player?.position),
      ]);

      if (!teamAbbr || allNeeds.length === 0) {
        return null;
      }

      return {
        teamAbbr,
        teamName: row.sort?.trim() || teamAbbr,
        topNeeds: allNeeds.slice(0, 3),
        allNeeds,
      } satisfies TeamNeedsRecord;
    })
    .filter((row): row is TeamNeedsRecord => Boolean(row));
};

export const fetchTeamNeedsFromNflMockDraftDatabase = async () => {
  const response = await fetch(TEAM_NEEDS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NFLManagerBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch team needs page (${response.status})`);
  }

  const html = await response.text();
  return parseTeamNeedsHtml(html);
};
