export const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeTeamName = (value: string): string => normalizeName(value);

export const normalizePlayerName = (value: string): string =>
  normalizeName(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeTeamSlug = (value: string): string =>
  normalizeTeamName(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
