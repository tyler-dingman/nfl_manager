const ACRONYMS = new Set([
  'afc',
  'cb',
  'db',
  'dl',
  'edge',
  'gm',
  'lb',
  'nfc',
  'nfl',
  'ol',
  'qb',
  'rb',
  'te',
  'wr',
]);
const LOWERCASE_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);

const cleanToken = (token: string, index: number) => {
  const match = token.match(/^(.*?)([,:;.!?]?)$/);
  const word = match?.[1] ?? token;
  const punctuation = match?.[2] ?? '';
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return `${lower.toUpperCase()}${punctuation}`;
  if (index > 0 && LOWERCASE_WORDS.has(lower)) return `${lower}${punctuation}`;
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}${punctuation}`;
};

/** Defensive display cleanup for source-supplied social/video titles. */
export function normalizeDisplayHeadline(rawTitle: string) {
  const cleaned = rawTitle
    .replace(/^\s*(?:update|breaking(?: news)?)\s*:\s*/i, '')
    .replace(/["“”'‘’]/g, '')
    .replace(/(?:\s+#[\p{L}\p{N}_-]+)+\s*$/gu, '')
    .replace(/\s*[|·-]\s*(?:subscribe|watch now|official video).*$/i, '')
    .replace(/[!?]{2,}/g, '!')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || !/^[^a-z]*$/.test(cleaned)) return cleaned;
  return cleaned.split(' ').map(cleanToken).join(' ');
}
