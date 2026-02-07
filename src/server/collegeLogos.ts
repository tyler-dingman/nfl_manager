import collegeLogos from '@/data/college-logos.json';

const LOGO_MAP = collegeLogos as Record<string, string>;

const normalizeCollegeName = (name: string) =>
  name
    .replace(/\([^)]*\)/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

const ALIASES: Record<string, string> = {
  'Miami Fla': 'Miami',
  'Miami (Fla)': 'Miami',
  'Arizona St': 'Arizona State',
  'Arizona St.': 'Arizona State',
  USC: 'USC',
};

const toKey = (name: string) => {
  const normalized = normalizeCollegeName(name);
  return ALIASES[normalized] ?? normalized;
};

export const getCollegeLogoUrl = async (collegeName: string): Promise<string | null> => {
  if (!collegeName) return null;
  const key = toKey(collegeName);
  const direct = LOGO_MAP[key];
  if (direct) return direct;

  const normalized = normalizeCollegeName(collegeName);
  const fallback = LOGO_MAP[normalized];
  return fallback || null;
};
