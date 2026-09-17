import seed from '../src/data/front-office/2026-week-1-news.json';

const teams = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LV',
  'LAC',
  'LAR',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SF',
  'SEA',
  'TB',
  'TEN',
  'WAS',
] as const;
const known = new Set<string>(teams);
const stories = seed.stories;
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const countTag = (tag: string) => stories.filter((story) => story.tags.includes(tag)).length;
const countType = (type: string) => stories.filter((story) => story.storyType === type).length;
const associated = (team: string) => stories.filter((story) => story.teamIds.includes(team));
const uniqueIds = new Set(stories.map((story) => story.id));
const normalizedStories = new Set(stories.map((story) => normalized(story.headline)));
const represented = teams.filter((team) => associated(team).length > 0);
const researched = teams.filter((team) => seed.researchedTeamIds.includes(team));
const missingTeams = teams.filter((team) => !represented.includes(team));
const afterCutoff = stories.filter((story) => story.publishedAt > seed.cutoff);
const regularSeasonResults = stories.filter(
  (story) => story.tags.includes('GAME_RECAP') || story.tags.includes('REGULAR_SEASON_RESULT'),
);
const missingUrls = stories.filter((story) => !/^https?:\/\//.test(story.source.url));
const missingTeamIds = stories.filter((story) => !story.teamIds.length);
const unknownTeams = stories.flatMap((story) => story.teamIds.filter((team) => !known.has(team)));

console.log('2026 WEEK 1 FRONT OFFICE NEWS SEED');
console.log('=================================\n');
console.log(`Cutoff:\n${seed.cutoff}\n`);
console.log(`TEAMS RESEARCHED:\n${researched.length} / 32\n`);
console.log(`TEAMS REPRESENTED:\n${represented.length} / 32\n`);
console.log(`UNIQUE STORIES:\n${stories.length}\n`);
console.log('CATEGORY COUNTS:\n');
console.log(`Transactions: ${countType('TRANSACTION')}`);
console.log(`Injuries: ${countType('INJURY')}`);
console.log(`Contracts: ${countType('CONTRACT')}`);
console.log(`Trades: ${countTag('TRADE')}`);
console.log(`Signings: ${countTag('SIGNING')}`);
console.log(`Releases: ${countTag('RELEASE')}`);
console.log(`Roster: ${countTag('ROSTER')}`);
console.log(`Depth Chart: ${countTag('DEPTH_CHART')}`);
console.log(`Preseason: ${countTag('PRESEASON')}`);
console.log(`Rumors: ${countType('RUMOR')}`);
console.log(`Analysis: ${countType('ANALYSIS')}\n`);
console.log('SOURCE COVERAGE:\n');
console.log(
  `Official Team/NFL: ${stories.filter((story) => story.source.tier === 'OFFICIAL_NFL').length}`,
);
console.log('National Reporting: 0');
console.log('Local Reporting: 0\n');
console.log('VALIDATION:\n');
console.log(`Stories after cutoff: ${afterCutoff.length}`);
console.log(`2026 regular-season results: ${regularSeasonResults.length}`);
console.log(`Missing source URLs: ${missingUrls.length}`);
console.log(`Missing team IDs: ${missingTeamIds.length}`);
console.log(`Duplicate IDs: ${stories.length - uniqueIds.size}`);
console.log(`Duplicate normalized stories: ${stories.length - normalizedStories.size}`);
console.log(`Unknown teams: ${unknownTeams.length}\n`);
console.log('TEAM COVERAGE:\n');
for (const team of teams) console.log(`${team}: ${associated(team).length}`);
console.log(`\nMISSING TEAMS:\n${missingTeams.length ? missingTeams.join(', ') : 'NONE'}\n`);

for (const team of teams) {
  const items = associated(team).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const sources = [...new Set(items.map((story) => story.source.publisher))];
  const transactionCount = items.filter((story) => story.storyType === 'TRANSACTION').length;
  const injuryCount = items.filter((story) => story.storyType === 'INJURY').length;
  const contractCount = items.filter((story) => story.storyType === 'CONTRACT').length;
  const tradeCount = items.filter((story) => story.tags.includes('TRADE')).length;
  const signingCount = items.filter((story) => story.tags.includes('SIGNING')).length;
  const releaseCount = items.filter((story) => story.tags.includes('RELEASE')).length;
  const rosterCount = items.filter((story) =>
    story.tags.some((tag) => ['ROSTER', 'DEPTH_CHART', 'PRESEASON'].includes(tag)),
  ).length;
  const rumorCount = items.filter((story) => story.storyType === 'RUMOR').length;
  const analysisCount = items.filter((story) => story.storyType === 'ANALYSIS').length;
  const warnings = [
    items.length < 5 ? `Only ${items.length} associated stories.` : null,
    injuryCount === 0 ? 'No verified injury/availability context found.' : null,
    rosterCount === 0 ? 'No roster/depth-chart development found.' : null,
  ].filter(Boolean);
  console.log(`${team}\n------------------`);
  console.log(`Total associated stories: ${items.length}\n`);
  console.log(`Transactions: ${transactionCount}`);
  console.log(`Injuries: ${injuryCount}`);
  console.log(`Contracts: ${contractCount}`);
  console.log(`Trades: ${tradeCount}`);
  console.log(`Signings: ${signingCount}`);
  console.log(`Releases: ${releaseCount}`);
  console.log(`Roster/Depth Chart: ${rosterCount}`);
  console.log(`Rumors: ${rumorCount}`);
  console.log(`Analysis: ${analysisCount}\n`);
  console.log(`Newest seed story:\n${items[0]?.publishedAt.slice(0, 10) ?? 'NONE'}\n`);
  console.log(`Oldest seed story:\n${items.at(-1)?.publishedAt.slice(0, 10) ?? 'NONE'}\n`);
  console.log(`Sources:\n${sources.join('\n') || 'NONE'}\n`);
  if (warnings.length)
    console.log(`Status:\nREVIEW RECOMMENDED\n\nWARNING — ${team}\n${warnings.join('\n')}\n`);
  else console.log('Status:\nREADY\n');
}

const errors = [
  researched.length !== 32,
  represented.length !== 32,
  afterCutoff.length > 0,
  regularSeasonResults.length > 0,
  missingUrls.length > 0,
  missingTeamIds.length > 0,
  uniqueIds.size !== stories.length,
  normalizedStories.size !== stories.length,
  unknownTeams.length > 0,
];
if (errors.some(Boolean)) process.exitCode = 1;
