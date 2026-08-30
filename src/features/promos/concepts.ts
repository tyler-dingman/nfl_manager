export type PromoConcept = {
  id: 'postgame' | 'clean-up' | 'ice' | 'trenches' | 'feed' | 'toolbox';
  property: string;
  sponsor: string;
  logoPath?: string;
  eyebrow: string;
  description: string;
  campaignLine: string;
  accent: string;
  surface: string;
  stats: Array<{ label: string; value: string }>;
  featureTitle: string;
  featureLabel: string;
  featureCopy: string;
  secondaryLabel?: string;
  secondaryCopy?: string;
};

export const PROMO_CONCEPTS: PromoConcept[] = [
  {
    id: 'postgame',
    property: 'THE POSTGAME',
    sponsor: 'Garage Beer',
    logoPath: '/images/promos/garage-beer.png',
    eyebrow: 'FINAL WHISTLE',
    description:
      'The immediate destination for the final score, defining moments, fan reaction, press conferences, and what comes next.',
    campaignLine: 'Take a knee. Crack one open.',
    accent: '#F4D9B7',
    surface: '#8D1B1B',
    stats: [
      { label: 'Final', value: 'KC 27 · BUF 24' },
      { label: 'Player of the game', value: 'QB · 312 YDS' },
      { label: 'Next', value: 'vs. DEN · SUN' },
    ],
    featureTitle: 'THE GAME BALL & THE COLD ONE',
    featureLabel: 'Cold One · Unsung hero',
    featureCopy:
      'The punt-team gunner who flipped the field twice and never let the return game breathe.',
    secondaryLabel: 'Game Ball',
    secondaryCopy: 'Three touchdown drives and the winning conversion with 0:42 left.',
  },
  {
    id: 'clean-up',
    property: 'CLEAN IT UP',
    sponsor: 'DUDE Wipes',
    logoPath: '/images/promos/dude-wipes.png',
    eyebrow: 'MONDAY FILM ROOM',
    description:
      'A sharp, funny, football-native review of the mistakes that must get fixed before the next kickoff.',
    campaignLine: 'Flush the bad tape. Keep the lesson.',
    accent: '#BCEB46',
    surface: '#121212',
    stats: [
      { label: 'Penalties', value: '9' },
      { label: 'Turnovers', value: '2' },
      { label: 'Sacks allowed', value: '4' },
      { label: 'Third down', value: '31%' },
    ],
    featureTitle: 'WHAT NEEDS CLEANED UP?',
    featureLabel: 'The mess of the game',
    featureCopy:
      'A third-and-short false start turned a manageable drive into a punt—and erased the offense’s best opening-quarter rhythm.',
  },
  {
    id: 'ice',
    property: 'ICE IN HIS VEINS',
    sponsor: 'YETI',
    logoPath: '/images/promos/yeti.svg',
    eyebrow: 'CLUTCH PERFORMANCE OF THE WEEK',
    description:
      'A premium weekly award for the player or unit that delivered when the situation was at its coldest.',
    campaignLine: 'Pressure drops. Temperature does too.',
    accent: '#DFF7FF',
    surface: '#123E50',
    stats: [
      { label: 'Situation', value: '3RD & 12' },
      { label: 'Clock', value: '0:42' },
      { label: 'Result', value: '18-YD CONVERSION' },
    ],
    featureTitle: 'THE MOMENT',
    featureLabel: 'Quarterback · No. 15',
    featureCopy:
      'The pocket collapsed from both edges. He climbed, reset, and delivered the throw that ended the comeback.',
    secondaryLabel: 'The Cooler',
    secondaryCopy:
      'Weather, stadium intel, tailgate setup, and the gear worth bringing on game day.',
  },
  {
    id: 'trenches',
    property: 'IN THE TRENCHES',
    sponsor: 'Traeger',
    logoPath: '/images/promos/traeger.svg',
    eyebrow: 'WEEKLY MATCHUP',
    description:
      'Offensive-line and defensive-line matchups explained through the players, rates, and techniques that decide the game.',
    campaignLine: 'Games are won up front. Dinner is won out back.',
    accent: '#F0A347',
    surface: '#35271F',
    stats: [
      { label: 'KC pass block', value: '68% WIN' },
      { label: 'DEN pressure', value: '34.2%' },
      { label: 'Run block', value: 'EDGE · KC' },
    ],
    featureTitle: 'IT STARTS UP FRONT.',
    featureLabel: 'Key player to watch',
    featureCopy:
      'The right guard faces an interior rusher who wins early with power. Kansas City must control first contact.',
    secondaryLabel: 'Who has the edge?',
    secondaryCopy:
      'Kansas City—barely. Protection calls against simulated pressure will decide it.',
  },
  {
    id: 'feed',
    property: 'FEED THE BOYS',
    sponsor: 'Buffalo Wild Wings',
    logoPath: '/images/promos/buffalo-wild-wings.png',
    eyebrow: 'GAME-DAY SPREAD',
    description:
      'The matchup, the menu, and the tailgate plan—built for fans deciding what belongs on the table before kickoff.',
    campaignLine: 'Chiefs vs. Bills. Bring an appetite.',
    accent: '#F6C640',
    surface: '#3D241B',
    stats: [
      { label: 'Traditional', value: '20 WINGS' },
      { label: 'Boneless', value: '15 WINGS' },
      { label: 'Sides', value: 'NACHOS + DIP' },
      { label: 'Kickoff', value: '3:25 PM' },
    ],
    featureTitle: 'THE SPREAD',
    featureLabel: 'Game-day lineup',
    featureCopy:
      'Two heat levels, loaded nachos, ranch and bleu cheese, crisp vegetables, and one fourth-quarter refill.',
    secondaryLabel: 'Overtime',
    secondaryCopy:
      'A special live content block—and another round—when sixty minutes are not enough.',
  },
  {
    id: 'toolbox',
    property: 'THE TOOLBOX',
    sponsor: "Lowe's",
    logoPath: '/images/promos/lowes.svg',
    eyebrow: 'TACTICAL PREVIEW',
    description:
      'Three specific, understandable jobs a team must complete to win the week—without burying fans in a playbook.',
    campaignLine: 'Everything you need to get the job done.',
    accent: '#E6F0FF',
    surface: '#063B75',
    stats: [
      { label: '1', value: 'ESTABLISH THE RUN' },
      { label: '2', value: 'PRESSURE FOUR' },
      { label: '3', value: 'CLOSE THE MIDDLE' },
    ],
    featureTitle: 'THREE WAYS KC CAN BEAT DENVER',
    featureLabel: 'Built different',
    featureCopy:
      'Win early downs, force long protection calls, and make the quarterback throw outside the numbers.',
  },
];
