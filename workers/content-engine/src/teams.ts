export const TEAM_IDS = [
  'ari',
  'atl',
  'bal',
  'buf',
  'car',
  'chi',
  'cin',
  'cle',
  'dal',
  'den',
  'det',
  'gb',
  'hou',
  'ind',
  'jax',
  'kc',
  'lac',
  'lar',
  'lv',
  'mia',
  'min',
  'ne',
  'no',
  'nyg',
  'nyj',
  'phi',
  'pit',
  'sea',
  'sf',
  'tb',
  'ten',
  'was',
] as const;
export type TeamId = (typeof TEAM_IDS)[number];
export function teamId(value: unknown): TeamId {
  if (typeof value !== 'string' || !(TEAM_IDS as readonly string[]).includes(value))
    throw new Error('A valid lowercase NFL team ID is required.');
  return value as TeamId;
}
