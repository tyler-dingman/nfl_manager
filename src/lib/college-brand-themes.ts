export type CollegeBrandTheme = {
  id: string;
  displayName: string;
  primary: string;
  secondary: string;
};

const themes: Record<string, CollegeBrandTheme> = {
  alabama: { id: 'alabama', displayName: 'Alabama', primary: '#9E1B32', secondary: '#FFFFFF' },
  clemson: { id: 'clemson', displayName: 'Clemson', primary: '#F56600', secondary: '#522D80' },
  florida: { id: 'florida', displayName: 'Florida', primary: '#0021A5', secondary: '#FA4616' },
  georgia: { id: 'georgia', displayName: 'Georgia', primary: '#BA0C2F', secondary: '#FFFFFF' },
  indiana: { id: 'indiana', displayName: 'Indiana', primary: '#990000', secondary: '#FFFFFF' },
  iowa: { id: 'iowa', displayName: 'Iowa', primary: '#FFCD00', secondary: '#000000' },
  lsu: { id: 'lsu', displayName: 'LSU', primary: '#461D7C', secondary: '#FDD023' },
  miami: { id: 'miami', displayName: 'Miami', primary: '#F47321', secondary: '#005030' },
  missouri: { id: 'missouri', displayName: 'Missouri', primary: '#F1B82D', secondary: '#000000' },
  'notre-dame': {
    id: 'notre-dame',
    displayName: 'Notre Dame',
    primary: '#C99700',
    secondary: '#0C2340',
  },
  'ohio-state': {
    id: 'ohio-state',
    displayName: 'Ohio State',
    primary: '#BB0000',
    secondary: '#FFFFFF',
  },
  oklahoma: { id: 'oklahoma', displayName: 'Oklahoma', primary: '#841617', secondary: '#FFFFFF' },
  'ole-miss': { id: 'ole-miss', displayName: 'Ole Miss', primary: '#CE1126', secondary: '#14213D' },
  oregon: { id: 'oregon', displayName: 'Oregon', primary: '#FEE123', secondary: '#154733' },
  'penn-state': {
    id: 'penn-state',
    displayName: 'Penn State',
    primary: '#1E407C',
    secondary: '#FFFFFF',
  },
  'south-carolina': {
    id: 'south-carolina',
    displayName: 'South Carolina',
    primary: '#73000A',
    secondary: '#FFFFFF',
  },
  texas: { id: 'texas', displayName: 'Texas', primary: '#BF5700', secondary: '#FFFFFF' },
  'texas-tech': {
    id: 'texas-tech',
    displayName: 'Texas Tech',
    primary: '#CC0000',
    secondary: '#FFFFFF',
  },
  usc: { id: 'usc', displayName: 'USC', primary: '#990000', secondary: '#FFC72C' },
};

const aliases: Record<string, string> = {
  'miami-fl': 'miami',
  'miami-florida': 'miami',
  mississippi: 'ole-miss',
  'ohio-st': 'ohio-state',
  'penn-st': 'penn-state',
  'southern-california': 'usc',
};

export function canonicalCollegeId(value?: string | null) {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return aliases[normalized] ?? normalized;
}

export function resolveCollegeBrandTheme(value?: string | null) {
  const id = canonicalCollegeId(value);
  return id ? (themes[id] ?? null) : null;
}
