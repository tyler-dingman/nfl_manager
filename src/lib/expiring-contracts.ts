export type ExpiringContractRow = {
  id: string;
  name: string;
  pos: string;
  estValue: number;
  maxValue: number;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const EXPIRING_CONTRACTS: ExpiringContractRow[] = [
  {
    id: slugify('Brandon Graham EDGE'),
    name: 'Brandon Graham',
    pos: 'EDGE',
    estValue: 22299000,
    maxValue: 26595000,
  },
  {
    id: slugify("Adoree' Jackson CB"),
    name: "Adoree' Jackson",
    pos: 'CB',
    estValue: 17468000,
    maxValue: 20850000,
  },
  {
    id: slugify('Dallas Goedert TE'),
    name: 'Dallas Goedert',
    pos: 'TE',
    estValue: 13498000,
    maxValue: 15881000,
  },
  {
    id: slugify('Ogbo Okoronkwo EDGE'),
    name: 'Ogbo Okoronkwo',
    pos: 'EDGE',
    estValue: 22299000,
    maxValue: 26595000,
  },
  {
    id: slugify('Matt Pryor OG'),
    name: 'Matt Pryor',
    pos: 'OG',
    estValue: 24631000,
    maxValue: 27188000,
  },
  {
    id: slugify('Fred Johnson OT'),
    name: 'Fred Johnson',
    pos: 'OT',
    estValue: 24631000,
    maxValue: 27188000,
  },
  {
    id: slugify('Marcus Epps S'),
    name: 'Marcus Epps',
    pos: 'S',
    estValue: 16043000,
    maxValue: 20326000,
  },
  {
    id: slugify('Brett Toth OG'),
    name: 'Brett Toth',
    pos: 'OG',
    estValue: 24631000,
    maxValue: 27188000,
  },
  {
    id: slugify('A.J. Dillon RB'),
    name: 'A.J. Dillon',
    pos: 'RB',
    estValue: 11401000,
    maxValue: 14143000,
  },
  {
    id: slugify('Joshua Uche EDGE'),
    name: 'Joshua Uche',
    pos: 'EDGE',
    estValue: 22299000,
    maxValue: 26595000,
  },
  {
    id: slugify('Quez Watkins WR'),
    name: 'Quez Watkins',
    pos: 'WR',
    estValue: 24361000,
    maxValue: 28046000,
  },
  {
    id: slugify('Braden Mann P'),
    name: 'Braden Mann',
    pos: 'P',
    estValue: 6075000,
    maxValue: 6719000,
  },
  {
    id: slugify('Jaelan Phillips EDGE'),
    name: 'Jaelan Phillips',
    pos: 'EDGE',
    estValue: 22299000,
    maxValue: 26595000,
  },
  {
    id: slugify('Ambry Thomas CB'),
    name: 'Ambry Thomas',
    pos: 'CB',
    estValue: 17468000,
    maxValue: 20850000,
  },
  {
    id: slugify('Kylen Granson TE'),
    name: 'Kylen Granson',
    pos: 'TE',
    estValue: 13498000,
    maxValue: 15881000,
  },
  {
    id: slugify('Azeez Ojulari EDGE'),
    name: 'Azeez Ojulari',
    pos: 'EDGE',
    estValue: 22299000,
    maxValue: 26595000,
  },
  {
    id: slugify('Jahan Dotson WR'),
    name: 'Jahan Dotson',
    pos: 'WR',
    estValue: 24361000,
    maxValue: 28046000,
  },
  {
    id: slugify('Sam Howell QB'),
    name: 'Sam Howell',
    pos: 'QB',
    estValue: 39720000,
    maxValue: 46073000,
  },
  {
    id: slugify('Nakobe Dean LB'),
    name: 'Nakobe Dean',
    pos: 'LB',
    estValue: 22990000,
    maxValue: 27454000,
  },
  {
    id: slugify('Grant Calcaterra TE'),
    name: 'Grant Calcaterra',
    pos: 'TE',
    estValue: 13498000,
    maxValue: 15881000,
  },
  {
    id: slugify('Chance Campbell LB'),
    name: 'Chance Campbell',
    pos: 'LB',
    estValue: 22990000,
    maxValue: 27454000,
  },
  {
    id: slugify('Tariq Castro-Fields CB'),
    name: 'Tariq Castro-Fields',
    pos: 'CB',
    estValue: 17468000,
    maxValue: 20850000,
  },
  {
    id: slugify('Danny Gray WR'),
    name: 'Danny Gray',
    pos: 'WR',
    estValue: 24361000,
    maxValue: 28046000,
  },
  {
    id: slugify('Reed Blankenship S'),
    name: 'Reed Blankenship',
    pos: 'S',
    estValue: 16043000,
    maxValue: 20326000,
  },
  {
    id: slugify('Cameron Latu TE'),
    name: 'Cameron Latu',
    pos: 'TE',
    estValue: 13498000,
    maxValue: 15881000,
  },
  {
    id: slugify('John Ojukwu OT'),
    name: 'John Ojukwu',
    pos: 'OT',
    estValue: 24631000,
    maxValue: 27188000,
  },
  {
    id: slugify('Jose Ramirez EDGE'),
    name: 'Jose Ramirez',
    pos: 'EDGE',
    estValue: 22299000,
    maxValue: 26595000,
  },
  {
    id: slugify('Ben VanSumeren LB'),
    name: 'Ben VanSumeren',
    pos: 'LB',
    estValue: 22990000,
    maxValue: 27454000,
  },
  {
    id: slugify('E.J. Jenkins TE'),
    name: 'E.J. Jenkins',
    pos: 'TE',
    estValue: 13498000,
    maxValue: 15881000,
  },
  {
    id: slugify('Carson Steele RB'),
    name: 'Carson Steele',
    pos: 'RB',
    estValue: 11401000,
    maxValue: 14143000,
  },
  {
    id: slugify('Jaheim Bell TE'),
    name: 'Jaheim Bell',
    pos: 'TE',
    estValue: 13498000,
    maxValue: 15881000,
  },
  {
    id: slugify("Andre' Sam S"),
    name: "Andre' Sam",
    pos: 'S',
    estValue: 16043000,
    maxValue: 20326000,
  },
  {
    id: slugify('Gabe Hall DT'),
    name: 'Gabe Hall',
    pos: 'DT',
    estValue: 21008000,
    maxValue: 25602000,
  },
  {
    id: slugify('Darius Cooper WR'),
    name: 'Darius Cooper',
    pos: 'WR',
    estValue: 24361000,
    maxValue: 28046000,
  },
];
