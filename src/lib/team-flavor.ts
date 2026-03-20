import { createRng } from '@/lib/deterministic-rng';

export type TeamFlavorTone =
  | 'positive'
  | 'celebratory'
  | 'suspenseful'
  | 'confident'
  | 'neutral';

export type TeamFlavorPhraseCategory =
  | 'fanPhrases'
  | 'hashtags'
  | 'positiveReactions'
  | 'neutralReactions'
  | 'celebrationLines'
  | 'confidentReactions';

export type TeamFlavor = {
  teamAbbr: string;
  teamName: string;
  identityLabel: string;
  fanbaseName?: string;
  fanPhrases: string[];
  hashtags: string[];
  positiveReactions: string[];
  neutralReactions: string[];
  celebrationLines: string[];
  confidentReactions: string[];
};

const DEFAULT_TEAM_FLAVOR: TeamFlavor = {
  teamAbbr: 'NFL',
  teamName: 'NFL Team',
  identityLabel: 'Franchise Football',
  fanPhrases: ['Build it right', 'Set the tone', 'Keep stacking wins'],
  hashtags: ['#FalcoFranchise', '#BuildTheRoster'],
  positiveReactions: ['Fans will love that move.', 'That fits the vision.'],
  neutralReactions: ['Interesting move here.', 'There is something building.'],
  celebrationLines: ['That is a big one.', 'That should energize the building.'],
  confidentReactions: ['This front office knows what it wants.', 'That is a statement move.'],
};

// Keep flavor copy centralized here so future systems can reuse it without
// scattering team-specific strings through UI components or server routes.
const TEAM_FLAVOR: Record<string, TeamFlavor> = {
  ARI: {
    teamAbbr: 'ARI',
    teamName: 'Arizona Cardinals',
    identityLabel: 'Red Sea Energy',
    fanbaseName: 'Red Sea',
    fanPhrases: ['Red Sea', 'Bird Gang', 'Defend the desert', 'Keep Arizona loud'],
    hashtags: ['#RedSea', '#BirdGang'],
    positiveReactions: ['Red Sea will like that one.', 'Bird Gang can get behind this.'],
    neutralReactions: ['Arizona will watch this closely.', 'The desert is paying attention.'],
    celebrationLines: ['Bird Gang is ready to roar.', 'That move should wake up the Red Sea.'],
    confidentReactions: ['Arizona just got sharper.', 'That feels like a real Cardinals move.'],
  },
  ATL: {
    teamAbbr: 'ATL',
    teamName: 'Atlanta Falcons',
    identityLabel: 'Rise Up',
    fanPhrases: ['Rise Up', 'Atlanta speed', 'Bring the juice', 'Own the South'],
    hashtags: ['#RiseUp', '#DirtyBirds'],
    positiveReactions: ['Rise Up energy on that move.', 'Atlanta needed a lift like that.'],
    neutralReactions: ['The city will be talking.', 'Atlanta sees the upside here.'],
    celebrationLines: ['Rise Up is going to echo after that one.', 'That should light up Atlanta.'],
    confidentReactions: ['That is a strong Falcons swing.', 'Atlanta just got more dangerous.'],
  },
  BAL: {
    teamAbbr: 'BAL',
    teamName: 'Baltimore Ravens',
    identityLabel: 'Ravens Flock',
    fanbaseName: 'Ravens Flock',
    fanPhrases: ['Ravens Flock', 'Play Like a Raven', 'Purple pressure', 'Baltimore edge'],
    hashtags: ['#RavensFlock', '#PlayLikeARaven'],
    positiveReactions: ['Ravens Flock will respect that move.', 'That feels very Baltimore.'],
    neutralReactions: ['The Flock is watching this one.', 'Baltimore sees the edge in it.'],
    celebrationLines: ['Ravens Flock is going to love that tone.', 'That should play in Baltimore.'],
    confidentReactions: ['That is Ravens football.', 'Baltimore just got meaner.'],
  },
  BUF: {
    teamAbbr: 'BUF',
    teamName: 'Buffalo Bills',
    identityLabel: 'Circle the Wagons',
    fanbaseName: 'Bills Mafia',
    fanPhrases: ['Bills Mafia', 'Circle the Wagons', 'Buffalo toughness', 'Own the cold'],
    hashtags: ['#BillsMafia', '#CircleTheWagons'],
    positiveReactions: ['Bills Mafia will be fired up.', 'Buffalo will love that kind of move.'],
    neutralReactions: ['Buffalo is taking notice.', 'The wagons might be moving here.'],
    celebrationLines: ['Bills Mafia will go wild for that.', 'Circle the Wagons after that one.'],
    confidentReactions: ['That is a Buffalo statement.', 'The Bills just got tougher.'],
  },
  CAR: {
    teamAbbr: 'CAR',
    teamName: 'Carolina Panthers',
    identityLabel: 'Keep Pounding',
    fanPhrases: ['Keep Pounding', 'Panthers grit', 'Bring the fight', 'Carolina edge'],
    hashtags: ['#KeepPounding', '#Panthers'],
    positiveReactions: ['Keep Pounding fits that move.', 'Carolina needed that kind of spark.'],
    neutralReactions: ['Carolina is watching this unfold.', 'There is real upside here for the Panthers.'],
    celebrationLines: ['Keep Pounding will sound better after that one.', 'That gives Carolina real juice.'],
    confidentReactions: ['That is a strong Panthers move.', 'Carolina just added some edge.'],
  },
  CHI: {
    teamAbbr: 'CHI',
    teamName: 'Chicago Bears',
    identityLabel: 'Bear Down',
    fanPhrases: ['Bear Down', 'Chicago football', 'Play in the cold', 'Bring the punch'],
    hashtags: ['#BearDown', '#DaBears'],
    positiveReactions: ['Bear Down fans will appreciate that.', 'That feels right for Chicago.'],
    neutralReactions: ['Chicago is paying attention.', 'This one has real Windy City intrigue.'],
    celebrationLines: ['Bear Down should sound loud after that.', 'That is a Chicago crowd-pleaser.'],
    confidentReactions: ['That is Bears football.', 'Chicago just got more physical.'],
  },
  CIN: {
    teamAbbr: 'CIN',
    teamName: 'Cincinnati Bengals',
    identityLabel: 'Rule the Jungle',
    fanPhrases: ['Who Dey', 'Rule the Jungle', 'Jungle energy', 'Cincy swagger'],
    hashtags: ['#WhoDey', '#RuleTheJungle'],
    positiveReactions: ['Who Dey will get behind that one.', 'The Jungle will like that move.'],
    neutralReactions: ['Cincy is watching closely.', 'There is real Jungle buzz here.'],
    celebrationLines: ['Who Dey is going to be loud after that.', 'That should juice the Jungle.'],
    confidentReactions: ['That is a Bengals swing with conviction.', 'Cincy just got more dangerous.'],
  },
  CLE: {
    teamAbbr: 'CLE',
    teamName: 'Cleveland Browns',
    identityLabel: 'Dawg Pound',
    fanbaseName: 'Dawg Pound',
    fanPhrases: ['Dawg Pound', 'Cleveland toughness', 'Own the trenches', 'Brown and orange grit'],
    hashtags: ['#DawgPound', '#Browns'],
    positiveReactions: ['Dawg Pound will love the grit in that.', 'That fits Cleveland.'],
    neutralReactions: ['Cleveland is sizing that up.', 'The Dawg Pound sees the angle here.'],
    celebrationLines: ['Dawg Pound is going to bark after that one.', 'That should play in Cleveland.'],
    confidentReactions: ['That is a Browns move.', 'Cleveland just got sturdier.'],
  },
  DAL: {
    teamAbbr: 'DAL',
    teamName: 'Dallas Cowboys',
    identityLabel: 'America’s Team Spotlight',
    fanPhrases: ['America’s Team', 'How Bout Them Cowboys', 'Big-stage football', 'Dallas spotlight'],
    hashtags: ['#Cowboys', '#AmericasTeam'],
    positiveReactions: ['Dallas will make noise about that one.', 'That is a move built for attention.'],
    neutralReactions: ['The spotlight is on this move.', 'Dallas is always good for a headline.'],
    celebrationLines: ['How Bout Them Cowboys after that.', 'That should light up the fanbase.'],
    confidentReactions: ['That is a headline-grabbing Cowboys swing.', 'Dallas just made a loud move.'],
  },
  DEN: {
    teamAbbr: 'DEN',
    teamName: 'Denver Broncos',
    identityLabel: 'Broncos Country',
    fanPhrases: ['Broncos Country', 'Mile High edge', 'Own the altitude', 'Orange and blue grit'],
    hashtags: ['#BroncosCountry', '#MileHigh'],
    positiveReactions: ['Broncos Country can get behind that.', 'That helps in Denver.'],
    neutralReactions: ['Denver is watching the board here.', 'There is real Mile High buzz now.'],
    celebrationLines: ['Broncos Country should like that move.', 'That one will play in Denver.'],
    confidentReactions: ['That is a smart Broncos push.', 'Denver just got more serious.'],
  },
  DET: {
    teamAbbr: 'DET',
    teamName: 'Detroit Lions',
    identityLabel: 'One Pride',
    fanbaseName: 'One Pride',
    fanPhrases: ['One Pride', 'Detroit grit', 'Bite kneecaps', 'Earn every yard'],
    hashtags: ['#OnePride', '#Lions'],
    positiveReactions: ['One Pride will love the edge there.', 'Detroit can rally around that.'],
    neutralReactions: ['Detroit sees the upside.', 'There is real One Pride intrigue here.'],
    celebrationLines: ['One Pride should be loud after that.', 'That is a Detroit-type move.'],
    confidentReactions: ['That is Lions football.', 'Detroit just added real bite.'],
  },
  GB: {
    teamAbbr: 'GB',
    teamName: 'Green Bay Packers',
    identityLabel: 'Go Pack Go',
    fanPhrases: ['Go Pack Go', 'Green Bay tradition', 'Titletown mindset', 'Lambeau energy'],
    hashtags: ['#GoPackGo', '#Titletown'],
    positiveReactions: ['Go Pack Go fits that move.', 'Green Bay will appreciate the value there.'],
    neutralReactions: ['Lambeau will be watching.', 'That has real Titletown intrigue.'],
    celebrationLines: ['Go Pack Go is going to sound good after that.', 'That should play in Green Bay.'],
    confidentReactions: ['That is a Packers move with purpose.', 'Green Bay just got cleaner.'],
  },
  HOU: {
    teamAbbr: 'HOU',
    teamName: 'Houston Texans',
    identityLabel: 'We Are Texans',
    fanPhrases: ['We Are Texans', 'Houston swagger', 'Own the South', 'Set the tone in Houston'],
    hashtags: ['#WeAreTexans', '#HTown'],
    positiveReactions: ['Houston will like that move.', 'That feels right for the Texans.'],
    neutralReactions: ['H-Town is watching this one.', 'There is some Houston buzz here.'],
    celebrationLines: ['Houston should be fired up after that.', 'That is a Texans crowd-pleaser.'],
    confidentReactions: ['That is a strong Texans move.', 'Houston just got sharper.'],
  },
  IND: {
    teamAbbr: 'IND',
    teamName: 'Indianapolis Colts',
    identityLabel: 'For The Shoe',
    fanPhrases: ['For The Shoe', 'Indy speed', 'Blue and white discipline', 'Win in Indy'],
    hashtags: ['#ForTheShoe', '#Colts'],
    positiveReactions: ['For The Shoe fits that one.', 'Indy will appreciate that move.'],
    neutralReactions: ['The Shoe is paying attention.', 'There is some Indy intrigue now.'],
    celebrationLines: ['For The Shoe should sound good after that.', 'That gives Indy a boost.'],
    confidentReactions: ['That is a Colts move with purpose.', 'Indianapolis just got more balanced.'],
  },
  JAX: {
    teamAbbr: 'JAX',
    teamName: 'Jacksonville Jaguars',
    identityLabel: 'DUUUVAL',
    fanPhrases: ['DUUUVAL', 'Jacksonville speed', 'Make it loud in Duval', 'Florida swagger'],
    hashtags: ['#DUUUVAL', '#Jaguars'],
    positiveReactions: ['DUUUVAL will love that one.', 'Jacksonville needed that spark.'],
    neutralReactions: ['Duval is watching closely.', 'That move has Jacksonville talking.'],
    celebrationLines: ['DUUUVAL should be loud after that.', 'That is a fun Jaguars move.'],
    confidentReactions: ['That is a clean Jaguars swing.', 'Jacksonville just got faster.'],
  },
  KC: {
    teamAbbr: 'KC',
    teamName: 'Kansas City Chiefs',
    identityLabel: 'Arrowhead Pride',
    fanbaseName: 'Chiefs Kingdom',
    fanPhrases: ['Chiefs Kingdom', 'Arrowhead Pride', 'Run it back', 'Let’s go Chiefs'],
    hashtags: ['#ChiefsKingdom', '#ArrowheadPride'],
    positiveReactions: ['Chiefs Kingdom loves that move.', 'Arrowhead will approve.'],
    neutralReactions: ['Arrowhead is watching this closely.', 'Chiefs Kingdom sees what you are building.'],
    celebrationLines: ['Chiefs Kingdom is going to be loud.', 'Arrowhead should love that one.'],
    confidentReactions: ['That is a Chiefs move with conviction.', 'Kansas City just sharpened the roster.'],
  },
  LAC: {
    teamAbbr: 'LAC',
    teamName: 'Los Angeles Chargers',
    identityLabel: 'Bolt Up',
    fanPhrases: ['Bolt Up', 'Chargers speed', 'Bring the spark', 'Own the AFC West'],
    hashtags: ['#BoltUp', '#Chargers'],
    positiveReactions: ['Bolt Up fits that one.', 'That should energize Chargers fans.'],
    neutralReactions: ['There is real buzz around this move.', 'The Bolts are watching carefully.'],
    celebrationLines: ['Bolt Up is going to sound good after that.', 'That should juice the fanbase.'],
    confidentReactions: ['That is a smart Chargers swing.', 'Los Angeles just got more dangerous.'],
  },
  LAR: {
    teamAbbr: 'LAR',
    teamName: 'Los Angeles Rams',
    identityLabel: 'Rams House',
    fanPhrases: ['Rams House', 'Hollywood football', 'Own the West', 'Blue and gold pressure'],
    hashtags: ['#RamsHouse', '#Rams'],
    positiveReactions: ['Rams House can get behind that.', 'That feels on-brand for the Rams.'],
    neutralReactions: ['Los Angeles is watching this one.', 'There is some Rams House buzz here.'],
    celebrationLines: ['Rams House should like that move.', 'That one fits the Rams’ style.'],
    confidentReactions: ['That is a Rams swing with intent.', 'Los Angeles just got cleaner.'],
  },
  LV: {
    teamAbbr: 'LV',
    teamName: 'Las Vegas Raiders',
    identityLabel: 'Raider Nation',
    fanbaseName: 'Raider Nation',
    fanPhrases: ['Raider Nation', 'Just win baby', 'Silver and black edge', 'Own the moment'],
    hashtags: ['#RaiderNation', '#JustWinBaby'],
    positiveReactions: ['Raider Nation approves.', 'That has real silver-and-black energy.'],
    neutralReactions: ['Vegas is watching the angle here.', 'Raider Nation sees the upside.'],
    celebrationLines: ['Raider Nation is going to love that.', 'Just win baby fits that move.'],
    confidentReactions: ['That is a Raiders swing with swagger.', 'Las Vegas just made a loud move.'],
  },
  MIA: {
    teamAbbr: 'MIA',
    teamName: 'Miami Dolphins',
    identityLabel: 'Fins Up',
    fanPhrases: ['Fins Up', 'South Florida speed', 'Make it splash', 'Dolphins pace'],
    hashtags: ['#FinsUp', '#PhinsUp'],
    positiveReactions: ['Fins Up after that one.', 'Miami fans will love the speed there.'],
    neutralReactions: ['South Florida is watching.', 'There is some Miami buzz here.'],
    celebrationLines: ['Fins Up is going to echo after that.', 'That should get Miami loud.'],
    confidentReactions: ['That is a Dolphins move with speed.', 'Miami just got more explosive.'],
  },
  MIN: {
    teamAbbr: 'MIN',
    teamName: 'Minnesota Vikings',
    identityLabel: 'SKOL',
    fanPhrases: ['SKOL', 'Purple pride', 'Defend the North', 'Minnesota toughness'],
    hashtags: ['#SKOL', '#Vikings'],
    positiveReactions: ['SKOL fans will love that pick.', 'That feels right for Minnesota.'],
    neutralReactions: ['SKOL is watching this closely.', 'Minnesota sees what this could become.'],
    celebrationLines: ['SKOL should sound loud after that.', 'That gives the Vikings some juice.'],
    confidentReactions: ['That is a Vikings move with purpose.', 'Minnesota just got more balanced.'],
  },
  NE: {
    teamAbbr: 'NE',
    teamName: 'New England Patriots',
    identityLabel: 'Do Your Job',
    fanPhrases: ['Do Your Job', 'Patriots discipline', 'Foxborough edge', 'Handle business'],
    hashtags: ['#DoYourJob', '#Patriots'],
    positiveReactions: ['New England will respect that move.', 'That has real Patriots discipline.'],
    neutralReactions: ['Foxborough is evaluating that one.', 'There is some Patriots buzz here.'],
    celebrationLines: ['Do Your Job fits that move.', 'That should play in New England.'],
    confidentReactions: ['That is a Patriots-style move.', 'New England just got more dependable.'],
  },
  NO: {
    teamAbbr: 'NO',
    teamName: 'New Orleans Saints',
    identityLabel: 'Who Dat',
    fanPhrases: ['Who Dat', 'Black and gold pride', 'Superdome energy', 'Make it loud in New Orleans'],
    hashtags: ['#WhoDat', '#Saints'],
    positiveReactions: ['Who Dat will like that one.', 'That should play in New Orleans.'],
    neutralReactions: ['The Dome is paying attention.', 'There is some Who Dat intrigue here.'],
    celebrationLines: ['Who Dat should sound good after that.', 'That one will energize New Orleans.'],
    confidentReactions: ['That is a Saints move with intent.', 'New Orleans just got stronger.'],
  },
  NYG: {
    teamAbbr: 'NYG',
    teamName: 'New York Giants',
    identityLabel: 'Big Blue',
    fanPhrases: ['Big Blue', 'Giants grit', 'New York toughness', 'Protect the Meadowlands'],
    hashtags: ['#BigBlue', '#Giants'],
    positiveReactions: ['Big Blue will appreciate that.', 'That gives the Giants some edge.'],
    neutralReactions: ['New York is sizing that up.', 'Big Blue sees the angle here.'],
    celebrationLines: ['Big Blue should feel good about that one.', 'That is a Giants-type move.'],
    confidentReactions: ['That is a clean Giants swing.', 'New York just got more physical.'],
  },
  NYJ: {
    teamAbbr: 'NYJ',
    teamName: 'New York Jets',
    identityLabel: 'Gang Green',
    fanPhrases: ['Gang Green', 'Take Flight', 'New York edge', 'Bring the heat'],
    hashtags: ['#GangGreen', '#TakeFlight'],
    positiveReactions: ['Gang Green will like that move.', 'That should help the Jets.'],
    neutralReactions: ['Take Flight has eyes on this one.', 'There is some Jets buzz here.'],
    celebrationLines: ['Take Flight should sound good after that.', 'That should energize Gang Green.'],
    confidentReactions: ['That is a Jets move with purpose.', 'New York just got more dangerous.'],
  },
  PHI: {
    teamAbbr: 'PHI',
    teamName: 'Philadelphia Eagles',
    identityLabel: 'Fly Eagles Fly',
    fanPhrases: ['Fly Eagles Fly', 'Philly toughness', 'Own the line of scrimmage', 'Midnight green edge'],
    hashtags: ['#FlyEaglesFly', '#Birds'],
    positiveReactions: ['Fly Eagles Fly fits that one.', 'Philly will love the toughness there.'],
    neutralReactions: ['The Birds are watching closely.', 'Philly sees the logic in this one.'],
    celebrationLines: ['Fly Eagles Fly is going to sound loud after that.', 'That should play in Philly.'],
    confidentReactions: ['That is an Eagles move with bite.', 'Philadelphia just got meaner.'],
  },
  PIT: {
    teamAbbr: 'PIT',
    teamName: 'Pittsburgh Steelers',
    identityLabel: 'Steeler Nation',
    fanbaseName: 'Steeler Nation',
    fanPhrases: ['Here We Go', 'Steeler Nation', 'Black and gold standard', 'Pittsburgh toughness'],
    hashtags: ['#HereWeGo', '#SteelerNation'],
    positiveReactions: ['Steeler Nation will respect that.', 'That feels right for Pittsburgh.'],
    neutralReactions: ['Pittsburgh is watching the details.', 'There is some Here We Go buzz here.'],
    celebrationLines: ['Here We Go is going to be loud after that.', 'That should play in Pittsburgh.'],
    confidentReactions: ['That is Steelers football.', 'Pittsburgh just got tougher.'],
  },
  SEA: {
    teamAbbr: 'SEA',
    teamName: 'Seattle Seahawks',
    identityLabel: '12s Energy',
    fanbaseName: '12s',
    fanPhrases: ['12s', 'Go Hawks', 'Seattle noise', 'Protect the Northwest'],
    hashtags: ['#GoHawks', '#Seahawks'],
    positiveReactions: ['The 12s will love that move.', 'Seattle can get behind that.'],
    neutralReactions: ['The 12s are watching closely.', 'There is some Go Hawks buzz here.'],
    celebrationLines: ['Go Hawks should sound loud after that.', 'That should fire up Seattle.'],
    confidentReactions: ['That is a Seahawks move with conviction.', 'Seattle just got more dangerous.'],
  },
  SF: {
    teamAbbr: 'SF',
    teamName: 'San Francisco 49ers',
    identityLabel: 'The Faithful',
    fanbaseName: 'The Faithful',
    fanPhrases: ['The Faithful', 'Bang Bang Niner Gang', 'Gold blooded', 'Own the West'],
    hashtags: ['#FTTB', '#BangBangNinerGang'],
    positiveReactions: ['The Faithful will love that one.', 'That feels very 49ers.'],
    neutralReactions: ['The Faithful is watching this closely.', 'There is real Niners buzz here.'],
    celebrationLines: ['Bang Bang Niner Gang after that.', 'That should play in Santa Clara.'],
    confidentReactions: ['That is a 49ers move with intent.', 'San Francisco just got even sharper.'],
  },
  TB: {
    teamAbbr: 'TB',
    teamName: 'Tampa Bay Buccaneers',
    identityLabel: 'Fire the Cannons',
    fanPhrases: ['Fire the Cannons', 'Pirate ship energy', 'Tampa aggression', 'Raise the flags'],
    hashtags: ['#GoBucs', '#FireTheCannons'],
    positiveReactions: ['Fire the Cannons fits that one.', 'Tampa should love that move.'],
    neutralReactions: ['The pirate ship is watching.', 'There is real Bucs buzz here.'],
    celebrationLines: ['Fire the Cannons after that one.', 'That should play in Tampa Bay.'],
    confidentReactions: ['That is a Buccaneers move with edge.', 'Tampa just got more dangerous.'],
  },
  TEN: {
    teamAbbr: 'TEN',
    teamName: 'Tennessee Titans',
    identityLabel: 'Titan Up',
    fanPhrases: ['Titan Up', 'Nashville toughness', 'Blue-collar football', 'Own the AFC South'],
    hashtags: ['#TitanUp', '#Titans'],
    positiveReactions: ['Titan Up fits that move.', 'Tennessee needed that kind of help.'],
    neutralReactions: ['Nashville is watching closely.', 'There is some Titans buzz here.'],
    celebrationLines: ['Titan Up should sound good after that.', 'That is a strong Tennessee move.'],
    confidentReactions: ['That is Titans football.', 'Tennessee just got tougher.'],
  },
  WAS: {
    teamAbbr: 'WAS',
    teamName: 'Washington Commanders',
    identityLabel: 'Take Command',
    fanPhrases: ['Take Command', 'Washington momentum', 'Burgundy and gold edge', 'Own the East'],
    hashtags: ['#TakeCommand', '#Commanders'],
    positiveReactions: ['Take Command fans will like that one.', 'Washington needed that kind of move.'],
    neutralReactions: ['Washington is watching this carefully.', 'There is some Commanders buzz here.'],
    celebrationLines: ['Take Command should sound better after that.', 'That should energize Washington.'],
    confidentReactions: ['That is a Commanders move with conviction.', 'Washington just got stronger.'],
  },
};

const recentSessionSelections = new Map<string, string[]>();

const normalizeTeamAbbr = (teamAbbr?: string | null) => teamAbbr?.trim().toUpperCase() ?? '';

const rememberSelection = (key: string, value: string) => {
  const current = recentSessionSelections.get(key) ?? [];
  const next = [...current.filter((entry) => entry !== value), value].slice(-2);
  recentSessionSelections.set(key, next);
};

const pickOption = (options: string[], key: string, seed?: string) => {
  if (options.length === 0) {
    return '';
  }

  if (seed) {
    const rng = createRng(`${key}:${seed}`);
    return options[Math.floor(rng() * options.length)] ?? options[0] ?? '';
  }

  const recent = recentSessionSelections.get(key) ?? [];
  const nextOption = options.find((option) => !recent.includes(option)) ?? options[0] ?? '';
  if (nextOption) {
    rememberSelection(key, nextOption);
  }
  return nextOption;
};

const categoryOptions = (flavor: TeamFlavor, category: TeamFlavorPhraseCategory) => {
  switch (category) {
    case 'fanPhrases':
      return flavor.fanPhrases;
    case 'hashtags':
      return flavor.hashtags;
    case 'positiveReactions':
      return flavor.positiveReactions;
    case 'neutralReactions':
      return flavor.neutralReactions;
    case 'celebrationLines':
      return flavor.celebrationLines;
    case 'confidentReactions':
      return flavor.confidentReactions;
  }
};

const toneToCategory = (tone: TeamFlavorTone): TeamFlavorPhraseCategory => {
  switch (tone) {
    case 'positive':
      return 'positiveReactions';
    case 'celebratory':
      return 'celebrationLines';
    case 'suspenseful':
      return 'neutralReactions';
    case 'confident':
      return 'confidentReactions';
    case 'neutral':
      return 'neutralReactions';
  }
};

export const getTeamFlavor = (teamAbbr?: string | null): TeamFlavor => {
  const normalized = normalizeTeamAbbr(teamAbbr);
  return TEAM_FLAVOR[normalized] ?? DEFAULT_TEAM_FLAVOR;
};

export const getRandomTeamPhrase = (
  teamAbbr: string | null | undefined,
  category: TeamFlavorPhraseCategory,
  options?: { seed?: string },
) => {
  const flavor = getTeamFlavor(teamAbbr);
  return pickOption(
    categoryOptions(flavor, category),
    `${flavor.teamAbbr}:${category}`,
    options?.seed,
  );
};

export const getTeamReactionLine = (
  teamAbbr: string | null | undefined,
  tone: TeamFlavorTone,
  options?: { seed?: string },
) => getRandomTeamPhrase(teamAbbr, toneToCategory(tone), options);

export const getTeamFlavorHandle = (teamAbbr?: string | null) => {
  const flavor = getTeamFlavor(teamAbbr);
  return flavor.fanbaseName ?? flavor.identityLabel;
};

export const formatTeamFlavorHeadline = (
  teamAbbr: string | null | undefined,
  template: string,
  options?: { seed?: string },
) => {
  const flavor = getTeamFlavor(teamAbbr);
  return template
    .replace('{teamName}', flavor.teamName)
    .replace('{identity}', flavor.identityLabel)
    .replace('{fanbase}', flavor.fanbaseName ?? flavor.identityLabel)
    .replace('{phrase}', getRandomTeamPhrase(teamAbbr, 'fanPhrases', options))
    .replace('{hashtag}', getRandomTeamPhrase(teamAbbr, 'hashtags', options));
};

export const getTeamFlavorDataset = () => TEAM_FLAVOR;
