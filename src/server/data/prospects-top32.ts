import type { PlayerRowDTO } from '@/types/player';

export type ProspectSeed = {
  id: string;
  rank: number;
  name: string;
  position: string;
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

export const TOP_50_PROSPECTS: ProspectSeed[] = [
  { id: 'fernando-mendoza-indiana', rank: 1, name: 'Fernando Mendoza', position: 'QB', college: 'Indiana' },
  { id: 'caleb-downs-ohio-state', rank: 2, name: 'Caleb Downs', position: 'S', college: 'Ohio State' },
  {
    id: 'arvell-reese-ohio-state',
    rank: 3,
    name: 'Arvell Reese',
    position: 'EDGE/LB',
    college: 'Ohio State',
  },
  {
    id: 'jeremiyah-love-notre-dame',
    rank: 4,
    name: 'Jeremiyah Love',
    position: 'RB',
    college: 'Notre Dame',
  },
  { id: 'rueben-bain-jr-miami-fl', rank: 5, name: 'Rueben Bain Jr.', position: 'EDGE', college: 'Miami (FL)' },
  {
    id: 'francis-mauigoa-miami-fl',
    rank: 6,
    name: 'Francis Mauigoa',
    position: 'OT',
    college: 'Miami (FL)',
  },
  { id: 'david-bailey-texas-tech', rank: 7, name: 'David Bailey', position: 'EDGE', college: 'Texas Tech' },
  {
    id: 'jordyn-tyson-arizona-state',
    rank: 8,
    name: 'Jordyn Tyson',
    position: 'WR',
    college: 'Arizona State',
  },
  {
    id: 'carnell-tate-ohio-state',
    rank: 9,
    name: 'Carnell Tate',
    position: 'WR',
    college: 'Ohio State',
  },
  {
    id: 'sonny-styles-ohio-state',
    rank: 10,
    name: 'Sonny Styles',
    position: 'LB',
    college: 'Ohio State',
  },
  { id: 'spencer-fano-utah', rank: 11, name: 'Spencer Fano', position: 'OT/IOL', college: 'Utah' },
  { id: 'jermod-mccoy-tennessee', rank: 12, name: 'Jermod McCoy', position: 'CB', college: 'Tennessee' },
  { id: 'peter-woods-clemson', rank: 13, name: 'Peter Woods', position: 'DL', college: 'Clemson' },
  { id: 'mansoor-delane-lsu', rank: 14, name: 'Mansoor Delane', position: 'CB', college: 'LSU' },
  { id: 'keldric-faulk-auburn', rank: 15, name: 'Keldric Faulk', position: 'EDGE', college: 'Auburn' },
  { id: 'makai-lemon-usc', rank: 16, name: 'Makai Lemon', position: 'WR', college: 'USC' },
  { id: 'kenyon-sadiq-oregon', rank: 17, name: 'Kenyon Sadiq', position: 'TE', college: 'Oregon' },
  {
    id: 'olaivavega-ioane-penn-state',
    rank: 18,
    name: 'Olaivavega Ioane',
    position: 'IOL',
    college: 'Penn State',
  },
  { id: 'kadyn-proctor-alabama', rank: 19, name: 'Kadyn Proctor', position: 'OT', college: 'Alabama' },
  { id: 'ty-simpson-alabama', rank: 20, name: 'Ty Simpson', position: 'QB', college: 'Alabama' },
  { id: 'avieon-terrell-clemson', rank: 21, name: 'Avieon Terrell', position: 'CB', college: 'Clemson' },
  { id: 'caleb-lomu-utah', rank: 22, name: 'Caleb Lomu', position: 'OT', college: 'Utah' },
  {
    id: 'cashius-howell-texas-am',
    rank: 23,
    name: 'Cashius Howell',
    position: 'EDGE',
    college: 'Texas A&M',
  },
  { id: 'akheem-mesidor-miami-fl', rank: 24, name: 'Akheem Mesidor', position: 'EDGE', college: 'Miami (FL)' },
  {
    id: 'emmanuel-mcneil-warren-toledo',
    rank: 25,
    name: 'Emmanuel McNeil-Warren',
    position: 'S',
    college: 'Toledo',
  },
  { id: 'cj-allen-georgia', rank: 26, name: 'CJ Allen', position: 'LB', college: 'Georgia' },
  { id: 'denzel-boston-washington', rank: 27, name: 'Denzel Boston', position: 'WR', college: 'Washington' },
  {
    id: 'kayden-mcdonald-ohio-state',
    rank: 28,
    name: 'Kayden McDonald',
    position: 'DL',
    college: 'Ohio State',
  },
  { id: 'caleb-banks-florida', rank: 29, name: 'Caleb Banks', position: 'DL', college: 'Florida' },
  { id: 'monroe-freeling-georgia', rank: 30, name: 'Monroe Freeling', position: 'OT', college: 'Georgia' },
  {
    id: 'kc-concepcion-texas-am',
    rank: 31,
    name: 'KC Concepcion',
    position: 'WR',
    college: 'Texas A&M',
  },
  { id: 'anthony-hill-jr-texas', rank: 32, name: 'Anthony Hill Jr.', position: 'LB', college: 'Texas' },
  { id: 'dillon-thieneman-oregon', rank: 33, name: 'Dillon Thieneman', position: 'S', college: 'Oregon' },
  { id: 't-j-parker-clemson', rank: 34, name: 'T.J. Parker', position: 'EDGE', college: 'Clemson' },
  { id: 'matayo-uiagalelei-oregon', rank: 35, name: 'Matayo Uiagalelei', position: 'EDGE', college: 'Oregon' },
  { id: 'brandon-cisse-south-carolina', rank: 36, name: 'Brandon Cisse', position: 'CB', college: 'South Carolina' },
  { id: 'chris-brazzell-ii-tennessee', rank: 37, name: 'Chris Brazzell II', position: 'WR', college: 'Tennessee' },
  { id: 'jake-golday-cincinnati', rank: 38, name: 'Jake Golday', position: 'LB', college: 'Cincinnati' },
  {
    id: 'max-iheanachor-arizona-state',
    rank: 39,
    name: 'Max Iheanachor',
    position: 'OT',
    college: 'Arizona State',
  },
  { id: 'christen-miller-georgia', rank: 40, name: 'Christen Miller', position: 'DL', college: 'Georgia' },
  { id: 'lee-hunter-texas-tech', rank: 41, name: 'Lee Hunter', position: 'DL', college: 'Texas Tech' },
  { id: 'malachi-fields-notre-dame', rank: 42, name: 'Malachi Fields', position: 'WR', college: 'Notre Dame' },
  {
    id: 'r-mason-thomas-oklahoma',
    rank: 43,
    name: 'R Mason Thomas',
    position: 'EDGE',
    college: 'Oklahoma',
  },
  { id: 'zion-young-missouri', rank: 44, name: 'Zion Young', position: 'EDGE', college: 'Missouri' },
  { id: 'omar-cooper-jr-indiana', rank: 45, name: 'Omar Cooper Jr.', position: 'WR', college: 'Indiana' },
  { id: 'blake-miller-clemson', rank: 46, name: 'Blake Miller', position: 'OT', college: 'Clemson' },
  { id: 'emmanuel-pregnon-oregon', rank: 47, name: 'Emmanuel Pregnon', position: 'IOL', college: 'Oregon' },
  { id: 'connor-lew-auburn', rank: 48, name: 'Connor Lew', position: 'C', college: 'Auburn' },
  { id: 'dante-moore-oregon', rank: 49, name: 'Dante Moore', position: 'QB', college: 'Oregon' },
  { id: 'josiah-trotter-missouri', rank: 50, name: 'Josiah Trotter', position: 'LB', college: 'Missouri' },
];

export const buildTop32Prospects = (): PlayerRowDTO[] =>
  TOP_50_PROSPECTS.map((prospect) => {
    const { firstName, lastName } = splitName(prospect.name);
    const stableId = prospect.id || `${slugify(prospect.name)}-${slugify(prospect.college)}`;
    const projectedRound = prospect.rank <= 32 ? 'Round 1' : 'Round 2';
    const gradeValue = 95 - (prospect.rank - 1) * 0.3;
    return {
      id: stableId,
      firstName,
      lastName,
      position: prospect.position,
      rank: prospect.rank,
      projectedPick: prospect.rank,
      college: prospect.college,
      grade: gradeValue.toFixed(1),
      projectedRound,
      contractYearsRemaining: 0,
      capHit: '-',
      status: 'Available',
      isDrafted: false,
    };
  });
