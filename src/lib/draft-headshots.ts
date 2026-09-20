import headshots from '@/server/data/draft-headshots-2027.json';

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(headshots.map((entry) => [normalize(entry.name), entry]));

/** Exact normalized names only; no fuzzy matches between different players. */
export const getDraftHeadshot = (name: string) => byName.get(normalize(name));
