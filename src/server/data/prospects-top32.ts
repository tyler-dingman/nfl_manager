import type { PlayerRowDTO } from '@/types/player';

export type ProspectSeed = {
  id: string;
  rank: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'IOL' | 'DL' | 'EDGE' | 'LB' | 'CB' | 'S';
  college: string;
  tags?: string[];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: name, lastName: '' };
  }
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
};

export const TOP_32_PROSPECTS: ProspectSeed[] = [
  {
    id: 'caleb-downs-ohio-state',
    rank: 1,
    name: 'Caleb Downs',
    position: 'S',
    college: 'Ohio State',
  },
  {
    id: 'jeremiah-smith-ohio-state',
    rank: 2,
    name: 'Jeremiah Smith',
    position: 'WR',
    college: 'Ohio State',
  },
  {
    id: 'keldric-faulk-auburn',
    rank: 3,
    name: 'Keldric Faulk',
    position: 'EDGE',
    college: 'Auburn',
  },
  { id: 'arch-manning-texas', rank: 4, name: 'Arch Manning', position: 'QB', college: 'Texas' },
  {
    id: 'a-j-harris-penn-state',
    rank: 5,
    name: 'A.J. Harris',
    position: 'CB',
    college: 'Penn State',
  },
  {
    id: 'anthony-hill-jr-texas',
    rank: 6,
    name: 'Anthony Hill Jr.',
    position: 'LB',
    college: 'Texas',
  },
  {
    id: 'lanorris-sellers-south-carolina',
    rank: 7,
    name: 'LaNorris Sellers',
    position: 'QB',
    college: 'South Carolina',
  },
  {
    id: 'david-bailey-texas-tech',
    rank: 8,
    name: 'David Bailey',
    position: 'EDGE',
    college: 'Texas Tech',
  },
  { id: 'cade-klubnik-clemson', rank: 9, name: 'Cade Klubnik', position: 'QB', college: 'Clemson' },
  { id: 'kj-bolden-georgia', rank: 10, name: 'KJ Bolden', position: 'S', college: 'Georgia' },
  {
    id: 'sonny-styles-ohio-state',
    rank: 11,
    name: 'Sonny Styles',
    position: 'LB',
    college: 'Ohio State',
  },
  {
    id: 'avieon-terrell-clemson',
    rank: 12,
    name: 'Avieon Terrell',
    position: 'CB',
    college: 'Clemson',
  },
  {
    id: 'francis-mauigoa-miami-fla',
    rank: 13,
    name: 'Francis Mauigoa',
    position: 'OT',
    college: 'Miami (Fla.)',
  },
  {
    id: 'olaivavega-ioane-penn-state',
    rank: 14,
    name: 'Olaivavega Ioane',
    position: 'IOL',
    college: 'Penn State',
  },
  { id: 't-j-parker-clemson', rank: 15, name: 'T.J. Parker', position: 'EDGE', college: 'Clemson' },
  { id: 'makai-lemon-usc', rank: 16, name: 'Makai Lemon', position: 'WR', college: 'USC' },
  {
    id: 'max-iheanachor-arizona-st',
    rank: 17,
    name: 'Max Iheanachor',
    position: 'OT',
    college: 'Arizona St.',
  },
  {
    id: 'kadyn-proctor-alabama',
    rank: 18,
    name: 'Kadyn Proctor',
    position: 'IOL',
    college: 'Alabama',
  },
  {
    id: 'kc-concepcion-texas-am',
    rank: 19,
    name: 'KC Concepcion',
    position: 'WR',
    college: 'Texas A&M',
  },
  { id: 'kenyon-sadiq-oregon', rank: 20, name: 'Kenyon Sadiq', position: 'TE', college: 'Oregon' },
  {
    id: 'monroe-freeling-georgia',
    rank: 21,
    name: 'Monroe Freeling',
    position: 'OT',
    college: 'Georgia',
  },
  { id: 'mansoor-delane-lsu', rank: 22, name: 'Mansoor Delane', position: 'CB', college: 'LSU' },
  {
    id: 'kayden-mcdonald-ohio-state',
    rank: 23,
    name: 'Kayden McDonald',
    position: 'DL',
    college: 'Ohio State',
  },
  {
    id: 'jake-golday-cincinnati',
    rank: 24,
    name: 'Jake Golday',
    position: 'LB',
    college: 'Cincinnati',
  },
  { id: 'caleb-lomu-utah', rank: 25, name: 'Caleb Lomu', position: 'OT', college: 'Utah' },
  {
    id: 'emmanuel-pregnon-oregon',
    rank: 26,
    name: 'Emmanuel Pregnon',
    position: 'IOL',
    college: 'Oregon',
  },
  {
    id: 'emmanuel-mcneil-warren-toledo',
    rank: 27,
    name: 'Emmanuel McNeil-Warren',
    position: 'S',
    college: 'Toledo',
  },
  {
    id: 'omar-cooper-jr-indiana',
    rank: 28,
    name: 'Omar Cooper Jr.',
    position: 'WR',
    college: 'Indiana',
  },
  { id: 'caleb-banks-florida', rank: 29, name: 'Caleb Banks', position: 'DL', college: 'Florida' },
  {
    id: 'cashius-howell-texas-am',
    rank: 30,
    name: 'Cashius Howell',
    position: 'EDGE',
    college: 'Texas A&M',
  },
  { id: 'ty-simpson-alabama', rank: 31, name: 'Ty Simpson', position: 'QB', college: 'Alabama' },
  { id: 'cj-allen-georgia', rank: 32, name: 'CJ Allen', position: 'LB', college: 'Georgia' },
];

export const buildTop32Prospects = (): PlayerRowDTO[] =>
  TOP_32_PROSPECTS.map((prospect) => {
    const { firstName, lastName } = splitName(prospect.name);
    const stableId = prospect.id || `${slugify(prospect.name)}-${slugify(prospect.college)}`;
    return {
      id: stableId,
      firstName,
      lastName,
      position: prospect.position,
      rank: prospect.rank,
      college: prospect.college,
      grade: `${94 - prospect.rank * 0.6}`,
      projectedRound: 'Round 1',
      contractYearsRemaining: 0,
      capHit: '-',
      status: 'Available',
      isDrafted: false,
    };
  });
