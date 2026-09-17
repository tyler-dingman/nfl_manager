import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CUTOFF = '2026-09-09T23:59:59.999Z';
const OUTPUT = path.resolve('src/data/front-office/2026-week-1-news.json');
const NFL = 'https://www.nfl.com';
const CUTS_URL = `${NFL}/news/nfl-roster-cuts-tracker-team-by-team-player-moves-ahead-of-2026-season`;
const PRACTICE_URL = `${NFL}/news/2026-nfl-practice-squad-tracker-team-by-team-roster-signings`;

const teams: Record<string, { abbr: string; short: string }> = {
  'Arizona Cardinals': { abbr: 'ARI', short: 'Cardinals' },
  'Atlanta Falcons': { abbr: 'ATL', short: 'Falcons' },
  'Baltimore Ravens': { abbr: 'BAL', short: 'Ravens' },
  'Buffalo Bills': { abbr: 'BUF', short: 'Bills' },
  'Carolina Panthers': { abbr: 'CAR', short: 'Panthers' },
  'Chicago Bears': { abbr: 'CHI', short: 'Bears' },
  'Cincinnati Bengals': { abbr: 'CIN', short: 'Bengals' },
  'Cleveland Browns': { abbr: 'CLE', short: 'Browns' },
  'Dallas Cowboys': { abbr: 'DAL', short: 'Cowboys' },
  'Denver Broncos': { abbr: 'DEN', short: 'Broncos' },
  'Detroit Lions': { abbr: 'DET', short: 'Lions' },
  'Green Bay Packers': { abbr: 'GB', short: 'Packers' },
  'Houston Texans': { abbr: 'HOU', short: 'Texans' },
  'Indianapolis Colts': { abbr: 'IND', short: 'Colts' },
  'Jacksonville Jaguars': { abbr: 'JAX', short: 'Jaguars' },
  'Kansas City Chiefs': { abbr: 'KC', short: 'Chiefs' },
  'Las Vegas Raiders': { abbr: 'LV', short: 'Raiders' },
  'Los Angeles Chargers': { abbr: 'LAC', short: 'Chargers' },
  'Los Angeles Rams': { abbr: 'LAR', short: 'Rams' },
  'Miami Dolphins': { abbr: 'MIA', short: 'Dolphins' },
  'Minnesota Vikings': { abbr: 'MIN', short: 'Vikings' },
  'New England Patriots': { abbr: 'NE', short: 'Patriots' },
  'New Orleans Saints': { abbr: 'NO', short: 'Saints' },
  'New York Giants': { abbr: 'NYG', short: 'Giants' },
  'New York Jets': { abbr: 'NYJ', short: 'Jets' },
  'Philadelphia Eagles': { abbr: 'PHI', short: 'Eagles' },
  'Pittsburgh Steelers': { abbr: 'PIT', short: 'Steelers' },
  'San Francisco 49ers': { abbr: 'SF', short: '49ers' },
  'Seattle Seahawks': { abbr: 'SEA', short: 'Seahawks' },
  'Tampa Bay Buccaneers': { abbr: 'TB', short: 'Buccaneers' },
  'Tennessee Titans': { abbr: 'TEN', short: 'Titans' },
  'Washington Commanders': { abbr: 'WAS', short: 'Commanders' },
};

const logoAliases: Record<string, string> = { AZ: 'ARI', LA: 'LAR', OAK: 'LV', WSH: 'WAS' };
const decode = (value: string) =>
  value
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
const text = (value: string) =>
  decode(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type SeedStory = {
  id: string;
  teamIds: string[];
  storyType: 'TRANSACTION' | 'INJURY' | 'CONTRACT' | 'RUMOR' | 'ANALYSIS';
  tags: string[];
  headline: string;
  summary: string;
  publishedAt: string;
  importanceScore: number;
  confidenceScore: number;
  source: { publisher: string; title: string; url: string; tier: 'OFFICIAL_NFL' };
};

const divisionPreviews = [
  {
    teams: ['BUF', 'MIA', 'NE', 'NYJ'],
    date: '2026-07-06T16:00:00.000Z',
    division: 'AFC East',
    url: `${NFL}/news/afc-east-training-camp-2026-preview-bills-dolphins-patriots-jets`,
  },
  {
    teams: ['BAL', 'CIN', 'CLE', 'PIT'],
    date: '2026-07-07T16:00:00.000Z',
    division: 'AFC North',
    url: `${NFL}/news/afc-north-training-camp-2026-preview-ravens-bengals-browns-steelers`,
  },
  {
    teams: ['HOU', 'IND', 'JAX', 'TEN'],
    date: '2026-07-08T16:00:00.000Z',
    division: 'AFC South',
    url: `${NFL}/news/afc-south-training-camp-2026-preview-texans-colts-jaguars-titans`,
  },
  {
    teams: ['DEN', 'KC', 'LV', 'LAC'],
    date: '2026-07-09T16:00:00.000Z',
    division: 'AFC West',
    url: `${NFL}/news/afc-west-training-camp-2026-preview-broncos-raiders-chargers-chiefs`,
  },
  {
    teams: ['DAL', 'NYG', 'PHI', 'WAS'],
    date: '2026-07-13T16:00:00.000Z',
    division: 'NFC East',
    url: `${NFL}/news/nfc-east-training-camp-2026-preview-cowboys-giants-eagles-commanders`,
  },
  {
    teams: ['CHI', 'DET', 'GB', 'MIN'],
    date: '2026-07-14T16:00:00.000Z',
    division: 'NFC North',
    url: `${NFL}/news/nfc-north-training-camp-2026-preview-bears-lions-packers-vikings`,
  },
  {
    teams: ['ATL', 'CAR', 'NO', 'TB'],
    date: '2026-07-15T16:00:00.000Z',
    division: 'NFC South',
    url: `${NFL}/news/nfc-south-training-camp-2026-preview-falcons-panthers-saints-buccaneers`,
  },
  {
    teams: ['ARI', 'LAR', 'SF', 'SEA'],
    date: '2026-07-16T16:00:00.000Z',
    division: 'NFC West',
    url: `${NFL}/news/nfc-west-training-camp-2026-preview-cardinals-rams-49ers-seahawks`,
  },
] as const;

const curatedStories: SeedStory[] = [
  {
    id: '2026-w1-league-training-camp-early-takeaways',
    teamIds: Object.values(teams)
      .map((team) => team.abbr)
      .sort(),
    storyType: 'ANALYSIS',
    tags: ['PRESEASON', 'DEPTH_CHART', 'ROSTER', 'TRAINING_CAMP', 'PRE_WEEK_1'],
    headline: 'Early training-camp takeaways identify developments across all 32 teams',
    summary:
      'NFL.com surveyed all 32 training camps, highlighting position battles, injury context, emerging players, and unresolved roster questions before the preseason schedule concluded.',
    publishedAt: '2026-08-06T16:00:00.000Z',
    importanceScore: 86,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: '2026 NFL training camp: Early takeaways for all 32 teams',
      url: `${NFL}/news/2026-nfl-training-camp-early-takeaways-for-all-32-teams`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-ind-jonathan-taylor-extension',
    teamIds: ['IND'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'PRE_WEEK_1'],
    headline: 'Colts extend Jonathan Taylor before the 2026 season',
    summary:
      'Indianapolis and Jonathan Taylor agreed to a new contract extension before Week 1, keeping the running back at the center of the Colts offense.',
    publishedAt: '2026-08-06T18:00:00.000Z',
    importanceScore: 92,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Jonathan Taylor, Colts agree to contract extension',
      url: `${NFL}/news/jonathan-taylor-colts-contract-extension`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-det-jahmyr-gibbs-extension',
    teamIds: ['DET'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'PRE_WEEK_1'],
    headline: 'Lions extend Jahmyr Gibbs before Week 1',
    summary:
      'Detroit reached a contract extension with Jahmyr Gibbs before the 2026 opener, securing a centerpiece of its offense.',
    publishedAt: '2026-08-06T18:00:00.000Z',
    importanceScore: 92,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Jahmyr Gibbs, Lions agree to contract extension',
      url: `${NFL}/news/jahmyr-gibbs-lions-contract-extension`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-tb-baker-mayfield-extension',
    teamIds: ['TB'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'PRE_WEEK_1'],
    headline: 'Buccaneers and Baker Mayfield agree to three-year extension',
    summary:
      "Tampa Bay and Baker Mayfield finalized a three-year extension before the regular season, resolving one of the club's major contract questions.",
    publishedAt: '2026-07-28T18:00:00.000Z',
    importanceScore: 94,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Buccaneers QB Baker Mayfield agrees to three-year contract extension',
      url: `${NFL}/news/nfl-network-buccaneers-qb-baker-mayfield-agree-to-three-year-contract-extension`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-lar-trent-mcduffie-extension',
    teamIds: ['LAR'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'TRADE', 'PRE_WEEK_1'],
    headline: 'Rams extend Trent McDuffie after trade',
    summary:
      'Los Angeles followed its acquisition of Trent McDuffie with a four-year extension, making the cornerback a long-term part of the Rams defense.',
    publishedAt: '2026-06-30T18:00:00.000Z',
    importanceScore: 92,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Trent McDuffie, Rams agree to four-year extension',
      url: `${NFL}/news/trent-mcduffie-rams-agree-to-four-year-124-million-extension`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-jax-brenton-strange-extension',
    teamIds: ['JAX'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'PRE_WEEK_1'],
    headline: 'Jaguars extend tight end Brenton Strange',
    summary:
      'Jacksonville agreed to a three-year extension with Brenton Strange before the season, retaining a key part of its passing-game personnel.',
    publishedAt: '2026-07-22T18:00:00.000Z',
    importanceScore: 84,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Jaguars, Brenton Strange agree to three-year extension',
      url: `${NFL}/news/jaguars-brenton-strange-three-year-extension`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-atl-kyle-pitts-extension',
    teamIds: ['ATL'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'PRE_WEEK_1'],
    headline: 'Falcons and Kyle Pitts agree to three-year extension',
    summary:
      "Atlanta retained Kyle Pitts on a three-year extension ahead of training camp, settling the tight end's long-term status.",
    publishedAt: '2026-06-23T18:00:00.000Z',
    importanceScore: 88,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Falcons TE Kyle Pitts agrees to three-year contract',
      url: `${NFL}/news/nfl-network-falcons-te-kyle-pitts-agrees-to-three-year-54m-contract`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-ari-michael-wilson-extension',
    teamIds: ['ARI'],
    storyType: 'CONTRACT',
    tags: ['CONTRACT_EXTENSION', 'PRE_WEEK_1'],
    headline: 'Cardinals extend wide receiver Michael Wilson',
    summary:
      'Arizona agreed to a three-year extension with Michael Wilson before the 2026 season, retaining the receiver beyond his rookie deal.',
    publishedAt: '2026-07-20T18:00:00.000Z',
    importanceScore: 84,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: 'Cardinals, Michael Wilson agree to three-year extension',
      url: `${NFL}/news/cardinals-michael-wilson-three-year-extension`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-hou-cj-stroud-extension-outlook',
    teamIds: ['HOU'],
    storyType: 'RUMOR',
    tags: ['CONTRACT_NEGOTIATION', 'UNRESOLVED', 'PRE_WEEK_1'],
    headline: 'C.J. Stroud enters camp with an extension still looming',
    summary:
      'C.J. Stroud publicly addressed his contract outlook while Houston entered the preseason without a completed extension. The item remains negotiation context, not a completed deal.',
    publishedAt: '2026-07-27T18:00:00.000Z',
    importanceScore: 82,
    confidenceScore: 90,
    source: {
      publisher: 'NFL.com',
      title: 'C.J. Stroud on looming contract extension entering 2026',
      url: `${NFL}/news/texans-qb-c-j-stroud-on-looming-contract-extension-entering-2026-i-think-i-ve-held-my-bargain-up`,
      tier: 'OFFICIAL_NFL',
    },
  },
  {
    id: '2026-w1-tb-extension-talks-unresolved',
    teamIds: ['TB'],
    storyType: 'RUMOR',
    tags: ['CONTRACT_NEGOTIATION', 'UNRESOLVED', 'PRE_WEEK_1'],
    headline: 'Buccaneers entered July in no rush on major extensions',
    summary:
      'NFL Network reported Tampa Bay was not rushing extension talks involving Baker Mayfield and Vita Vea. This captures the unresolved status at publication and is superseded where a later completed deal appears.',
    publishedAt: '2026-07-06T18:00:00.000Z',
    importanceScore: 72,
    confidenceScore: 88,
    source: {
      publisher: 'NFL.com',
      title: 'Buccaneers in no rush to work out Baker Mayfield, Vita Vea extensions',
      url: `${NFL}/news/nfl-network-buccaneers-in-no-rush-to-work-out-baker-mayfield-vita-vea-extensions`,
      tier: 'OFFICIAL_NFL',
    },
  },
];

async function get(url: string) {
  const response = await fetch(url, { headers: { 'user-agent': 'DownDistanceSeedResearch/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function trackerTeams(html: string) {
  const pattern =
    /aria-label="View details for ([^"]+)".*?<div class="story-part-rich-text-editor-wrapper"><ul>(.*?)<\/ul>/gs;
  const result = new Map<string, string[]>();
  for (const match of html.matchAll(pattern)) {
    const team = teams[decode(match[1])];
    if (!team || result.has(team.abbr)) continue;
    const players = [...match[2].matchAll(/<li>(.*?)<\/li>/gs)].map((item) => text(item[1]));
    if (players.length) result.set(team.abbr, players);
  }
  return result;
}

type Transaction = {
  from: string | null;
  to: string | null;
  date: string;
  name: string;
  transaction: string;
};

function teamFromCell(cell: string) {
  const match = cell.match(/clubs\/logos\/([A-Z]+)/);
  if (!match) return null;
  return logoAliases[match[1]] ?? match[1];
}

function transactionRows(html: string): Transaction[] {
  const body = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? '';
  return [...body.matchAll(/<tr>(.*?)<\/tr>/gs)].flatMap((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((cell) => cell[1]);
    if (cells.length < 6) return [];
    const [month, day] = text(cells[2]).split('/').map(Number);
    const publishedAt = new Date(Date.UTC(2026, month - 1, day, 17)).toISOString();
    if (publishedAt > CUTOFF) return [];
    return [
      {
        from: teamFromCell(cells[0]),
        to: teamFromCell(cells[1]),
        date: publishedAt,
        name: text(cells[3]),
        transaction: text(cells[5]),
      },
    ];
  });
}

async function ledger(category: string, month: number) {
  const root = `${NFL}/transactions/league/${category}/2026/${month}`;
  const rows: Transaction[] = [];
  let url: string | null = root;
  const visited = new Set<string>();
  while (url && !visited.has(url)) {
    visited.add(url);
    const html = await get(url);
    rows.push(...transactionRows(html));
    const next = html.match(/href="([^"]+)" class="nfl-o-table-pagination__next"/)?.[1];
    url = next ? new URL(decode(next), NFL).toString() : null;
  }
  return { root, rows };
}

function teamLabel(abbr: string) {
  return Object.values(teams).find((team) => team.abbr === abbr)?.short ?? abbr;
}

function aggregateStory(
  abbr: string,
  category: string,
  rows: Transaction[],
  sourceUrl: string,
): SeedStory {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const names = [...new Set(sorted.map((row) => row.name))];
  const label = teamLabel(abbr);
  const config: Record<string, { storyType: SeedStory['storyType']; tag: string; noun: string }> = {
    'reserve-list': { storyType: 'INJURY', tag: 'ROSTER_DESIGNATION', noun: 'reserve-list moves' },
    signings: { storyType: 'TRANSACTION', tag: 'SIGNING', noun: 'signings' },
    waivers: { storyType: 'TRANSACTION', tag: 'WAIVER', noun: 'waiver moves' },
    terminations: { storyType: 'TRANSACTION', tag: 'RELEASE', noun: 'releases' },
    other: { storyType: 'TRANSACTION', tag: 'ROSTER', noun: 'roster designations' },
  };
  const item = config[category];
  return {
    id: `2026-w1-${abbr.toLowerCase()}-${category}`,
    teamIds: [abbr],
    storyType: item.storyType,
    tags: [item.tag, 'TRANSACTION', 'PRE_WEEK_1'],
    headline: `${label} finalize pre–Week 1 ${item.noun}`,
    summary: `${label} recorded ${rows.length} ${item.noun} before the 2026 opener. The official NFL ledger includes ${names.slice(0, 5).join(', ')}${names.length > 5 ? ', and additional moves' : ''}.`,
    publishedAt: sorted[0].date,
    importanceScore: item.storyType === 'INJURY' ? 78 : 68,
    confidenceScore: 100,
    source: {
      publisher: 'NFL.com',
      title: `2026 NFL ${item.noun} by month`,
      url: sourceUrl,
      tier: 'OFFICIAL_NFL',
    },
  };
}

async function main() {
  const [cutsHtml, practiceHtml] = await Promise.all([get(CUTS_URL), get(PRACTICE_URL)]);
  const cuts = trackerTeams(cutsHtml);
  const practice = trackerTeams(practiceHtml);
  const stories: SeedStory[] = [...curatedStories];
  for (const preview of divisionPreviews) {
    for (const abbr of preview.teams) {
      const label = teamLabel(abbr);
      stories.push({
        id: `2026-w1-${abbr.toLowerCase()}-training-camp-preview`,
        teamIds: [abbr],
        storyType: 'ANALYSIS',
        tags: ['PRESEASON', 'DEPTH_CHART', 'ROSTER', 'TRAINING_CAMP', 'PRE_WEEK_1'],
        headline: `${label} enter camp with position battles and roster questions to resolve`,
        summary: `NFL.com's ${preview.division} training-camp preview examines the ${label}' offseason developments, key position battles, and primary roster storylines before the 2026 season.`,
        publishedAt: preview.date,
        importanceScore: 70,
        confidenceScore: 100,
        source: {
          publisher: 'NFL.com',
          title: `${preview.division} training camp 2026 preview`,
          url: preview.url,
          tier: 'OFFICIAL_NFL',
        },
      });
    }
  }
  for (const { abbr, short } of Object.values(teams)) {
    const released = cuts.get(abbr) ?? [];
    if (released.length)
      stories.push({
        id: `2026-w1-${abbr.toLowerCase()}-final-cuts`,
        teamIds: [abbr],
        storyType: 'TRANSACTION',
        tags: ['RELEASE', 'ROSTER', '53_MAN_CUTDOWN', 'PRE_WEEK_1'],
        headline: `${short} complete their initial 53-man roster cutdown`,
        summary: `${short} released or waived ${released.length} players while setting the initial roster. The NFL tracker includes ${released.slice(0, 5).join(', ')}${released.length > 5 ? ', and additional moves' : ''}.`,
        publishedAt: '2026-08-30T22:00:00.000Z',
        importanceScore: 72,
        confidenceScore: 100,
        source: {
          publisher: 'NFL.com',
          title: 'NFL roster cuts tracker: Team-by-team player moves ahead of 2026 season',
          url: CUTS_URL,
          tier: 'OFFICIAL_NFL',
        },
      });
    const signed = practice.get(abbr) ?? [];
    if (signed.length)
      stories.push({
        id: `2026-w1-${abbr.toLowerCase()}-practice-squad`,
        teamIds: [abbr],
        storyType: 'TRANSACTION',
        tags: ['SIGNING', 'PRACTICE_SQUAD', 'ROSTER', 'PRE_WEEK_1'],
        headline: `${short} assemble their initial 2026 practice squad`,
        summary: `${short} added ${signed.length} players to the initial practice squad, including ${signed.slice(0, 5).join(', ')}${signed.length > 5 ? ', and others' : ''}.`,
        publishedAt: '2026-09-01T21:31:00.000Z',
        importanceScore: 58,
        confidenceScore: 100,
        source: {
          publisher: 'NFL.com',
          title: '2026 NFL practice squad tracker',
          url: PRACTICE_URL,
          tier: 'OFFICIAL_NFL',
        },
      });
  }

  for (const category of ['reserve-list', 'signings', 'waivers', 'terminations', 'other']) {
    const pages = await Promise.all([ledger(category, 8), ledger(category, 9)]);
    const rows = pages.flatMap((page) => page.rows);
    for (const abbr of Object.values(teams).map((team) => team.abbr)) {
      const related = rows.filter((row) => row.from === abbr || row.to === abbr);
      if (related.length) stories.push(aggregateStory(abbr, category, related, pages[0].root));
    }
  }

  const tradePages = await Promise.all([ledger('trades', 8), ledger('trades', 9)]);
  const seenTrades = new Set<string>();
  for (const row of tradePages.flatMap((page) => page.rows)) {
    const teamIds = [
      ...new Set([row.from, row.to].filter((item): item is string => Boolean(item))),
    ];
    if (!teamIds.length) continue;
    const key = `${row.date}:${row.name}:${teamIds.sort().join('-')}`;
    if (seenTrades.has(key)) continue;
    seenTrades.add(key);
    stories.push({
      id: `2026-w1-trade-${slug(`${row.date}-${row.name}-${teamIds.join('-')}`)}`,
      teamIds,
      storyType: 'TRANSACTION',
      tags: ['TRADE', 'ROSTER', 'PRE_WEEK_1'],
      headline: `${teamLabel(row.from ?? teamIds[0])} trade ${row.name} to ${teamLabel(row.to ?? teamIds.at(-1)!)}`,
      summary: `The official NFL transaction ledger records ${row.name} moving from ${teamLabel(row.from ?? teamIds[0])} to ${teamLabel(row.to ?? teamIds.at(-1)!)} before Week 1.`,
      publishedAt: row.date,
      importanceScore: 82,
      confidenceScore: 100,
      source: {
        publisher: 'NFL.com',
        title: '2026 NFL trades by month',
        url: tradePages[0].root,
        tier: 'OFFICIAL_NFL',
      },
    });
  }

  stories.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `${JSON.stringify(
      {
        season: 2026,
        cutoff: CUTOFF,
        researchedTeamIds: Object.values(teams)
          .map((team) => team.abbr)
          .sort(),
        stories,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${stories.length} verified stories to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
