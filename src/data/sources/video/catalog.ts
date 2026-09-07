import { TEAM_SOURCE_PROFILES } from '@/data/sources/monitoring/team-baselines';
import type { VideoSourceCandidate } from './types';

const teamNames: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LV: 'Las Vegas Raiders',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WAS: 'Washington Commanders',
};

const lockedOnNames: Record<string, string> = { TB: 'Locked On Bucs', SF: 'Locked On 49ers' };
const kcUrls: Record<string, string> = {
  'Kansas City Chiefs': 'https://www.youtube.com/@KansasCityChiefs',
  'Locked On Chiefs': 'https://www.youtube.com/@LockedOnChiefs',
  'How Bout Those Chiefs': 'https://www.youtube.com/@hbtCHIEFS',
  "All Chief'd Up": 'https://www.youtube.com/@AllChiefdUp',
  ChiefsTV: 'https://www.youtube.com/@ChiefsTV',
  'Arrowhead Addict Podcast': 'https://www.youtube.com/@ArrowheadAddictPodcast',
  'RGR Football': 'https://www.youtube.com/@RGR',
};

const independent: Record<string, string[]> = {
  ARI: ['PHNX Cardinals', 'Arizona Sports Cardinals'],
  ATL: ['Dirty Birds & Brews', 'Pound 4 Pound ATL', 'Mad Mike Sports'],
  BAL: ['IngravenVids', '410 Sports Talk', 'The Ravens Vault'],
  BUF: ['Cover 1', 'Buffalo Plus', 'SHOUT! Buffalo Football Podcast'],
  CAR: ['C3 Panthers Podcast', 'Panther Nation Podcast', 'Panthers On Tap'],
  CHI: ['CHGO Bears', 'The Chicago Audible', '2nd City Gridiron', 'Chicago Bears Now'],
  CIN: ['Bengals on the Brain', 'The Growler', 'Wincinnati', 'The Jungle Roar'],
  CLE: ['Quincy Carrier', 'The OBR', 'Orange and Brown Talk', 'Browns Film Breakdown'],
  DAL: ['Voch Lombardi', 'Law Nation Sports', 'Blogging the Boys', 'Cowboys Report'],
  DEN: ['DNVR Broncos', "That's Good Sports", 'Mile High Huddle', 'Cody Roark NFL'],
  DET: [
    'Detroit Lions Podcast',
    'Detroit Lions Talk with MicroMike',
    "Let's Talk Lions",
    'Lions Talk Live',
  ],
  GB: ['Pack-A-Day Podcast', 'Matt Ramage', 'Packers Total Access', 'Tom Grossi'],
  HOU: ['Battle Red Blog video programming', 'Houston Texans local-media video source'],
  IND: ['Kevin Bowen / 107.5 The Fan', 'Colts Cover 2 / IndyStar', 'Colts-only creator'],
  JAX: ['GenJag', '1010XL Jaguars'],
  KC: [
    'How Bout Those Chiefs',
    "All Chief'd Up",
    'ChiefsTV',
    'Arrowhead Addict Podcast',
    'RGR Football',
  ],
  LV: ['Raiders Report', "Tape Don't Lie", 'Sanjit T.', 'The Autumn Windbags'],
  LAC: ['Guilty As Charged', 'Chargers Unleashed', 'Charger Chat Podcast', 'The Director'],
  LAR: ['Rams Brothers', 'Downtown Rams', 'LA Football Network Rams'],
  MIA: ['DouglieDoWrong', 'Phinside The NFL', 'TD Phins Talk'],
  MIN: ['Purple Daily', 'Purple FTW!', 'Vikings Territory'],
  NE: ['CLNS Patriots', 'NBC Sports Boston Patriots', 'Pats Pulpit'],
  NO: ['NewOrleans.Football / NOF Network', 'State of the Saints Podcast', 'Saints Happy Hour'],
  NYG: ["Talkin' Giants", 'Big Blue Banter', 'Fireside Giants', 'The Entertainah Talkin Sports'],
  NYJ: ['Jets X-Factor', 'Boy Green Daily', 'Play Like A Jet', 'Jets Talk 24/7'],
  PHI: [
    'PHLY Sports',
    'Inside the Birds',
    'JAKIB Sports',
    'Bleeding Green Nation',
    'A to Z Sports Philadelphia',
  ],
  PIT: ['Steelers Depot', 'Arthur Moats Experience', 'DK Pittsburgh Sports', 'Steelers Now'],
  SF: ['49ers Rush Podcast', 'Grant Cohn', 'The Krueg Show', 'NBC Sports Bay Area'],
  SEA: ['Seattle Overload', 'Seahawks Man 2 Man', 'Hawk Blogger', 'Seahawks Today'],
  TB: ['Pewter Report', 'Real Bucs Talk', 'MrBucsNation'],
  TEN: ['A to Z Sports Nashville', '440 Sports Titans', 'Music City Audible'],
  WAS: ['Street Scores', 'Louie Tee Network', 'Trap or Dive', 'Commanders Report'],
};

const slug = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const pending = (
  teamId: string | null,
  name: string,
  category: VideoSourceCandidate['category'],
  extra: Partial<VideoSourceCandidate> = {},
): VideoSourceCandidate => ({
  id: `YT_${teamId ?? 'NFL'}_${slug(name)}`,
  name,
  teamId,
  category,
  tags: [category],
  scope: teamId ? 'team' : 'league',
  multiTeam: false,
  priority: category === 'official' ? 1 : 2,
  sourceWeight:
    category === 'official' ? 1 : category === 'film' ? 0.95 : category === 'podcast' ? 0.85 : 0.85,
  status: 'REVIEW_REQUIRED',
  reviewReason: 'Immutable YouTube channel ID and recent team coverage have not been verified.',
  ...extra,
});

export const VIDEO_SOURCE_CANDIDATES: VideoSourceCandidate[] = [
  ...Object.keys(TEAM_SOURCE_PROFILES).flatMap((teamId) => {
    const team = teamNames[teamId];
    const locked = lockedOnNames[teamId] ?? `Locked On ${team.split(' ').at(-1)}`;
    return [
      pending(teamId, team, 'official', { candidateUrl: kcUrls[team] }),
      pending(teamId, locked, 'podcast', { candidateUrl: kcUrls[locked] }),
      ...(independent[teamId] ?? []).map((name) =>
        pending(teamId, name, name === 'RGR Football' ? 'film' : 'independent_media', {
          candidateUrl: kcUrls[name],
        }),
      ),
    ];
  }),
  pending(null, 'Mattydubs', 'film', {
    candidateUrl: 'https://www.youtube.com/@Mattydubs',
    priority: 1,
    sourceWeight: 0.95,
    multiTeam: true,
  }),
  pending(null, 'Football Analysis', 'film', { priority: 2, sourceWeight: 0.95, multiTeam: true }),
  pending(null, 'NFL / NFL Films', 'league_media', {
    priority: 1,
    sourceWeight: 1,
    multiTeam: true,
  }),
];

export const NFL_TEAM_NAMES = teamNames;
