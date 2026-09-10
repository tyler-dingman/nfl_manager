const ROOKIE_TAXONOMY = new Set([
  'ROOKIE',
  'ROOKIE WATCH',
  'DRAFT PICK DEVELOPMENT',
  'DRAFT CLASS',
  'FIRST-YEAR PLAYER',
]);
const CURRENT_ROOKIE_LANGUAGE =
  /\b(rookies?|first-year players?|draft picks? (?:is|are|has|have|continues?|develops?|impresses?|starts?|makes?|earns?)|draft class (?:is|has|looks?|continues?|develops?))\b/i;
const FUTURE_PROSPECT_LANGUAGE =
  /\b(prospects?|mock draft|big board|draft board|draft target|draft-eligible|college football|scouting combine|future draft|next (?:year'?s?|season'?s?) draft)\b/i;

export function shouldUseRookieBlueprintGraphic({
  category,
  headline,
  summary,
}: {
  category: string;
  headline?: string;
  summary?: string;
}) {
  const taxonomy = category.trim().toUpperCase().replaceAll('_', ' ');
  const copy = `${headline ?? ''} ${summary ?? ''}`;

  if (FUTURE_PROSPECT_LANGUAGE.test(copy)) return false;
  if (ROOKIE_TAXONOMY.has(taxonomy)) return true;
  return taxonomy === 'DRAFT' && CURRENT_ROOKIE_LANGUAGE.test(copy);
}
