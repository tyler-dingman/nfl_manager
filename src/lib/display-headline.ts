const ACRONYMS = new Set([
  'afc',
  'kc',
  'nfl',
  'nflpa',
  'ncaa',
  'espn',
  'cbs',
  'fox',
  'nbc',
  'abc',
  'pff',
  'usa',
  'td',
  'tds',
  'mvp',
  'ot',
  'dt',
  'de',
  'st',
  'hc',
  'oc',
  'dc',
  'ir',
  'udfa',
  'otas',
  'ii',
  'iii',
  'iv',
  'vi',
  'vii',
  'viii',
  'ix',
  'lvii',
  'lviii',
  'lix',
  'lx',
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

/** Defensive display cleanup for source-supplied social/video titles. */
export function normalizeDisplayHeadline(rawTitle: string) {
  const cleaned = rawTitle
    .replace(/^\s*(?:update|breaking(?: news)?)\s*:\s*/i, '')
    .replace(/["“”]/g, '')
    .replace(/(^|\s)['‘]([^'‘’]+)['’](?=\s|$|[.,!?])/g, '$1$2')
    .replace(/(?:\s+#[\p{L}\p{N}_-]+)+\s*$/gu, '')
    .replace(/\s*[|·-]\s*(?:subscribe|watch now|official video).*$/i, '')
    .replace(/[!?]{2,}/g, '!')
    .replace(/\s+/g, ' ')
    .trim();

  // Mixed-case source titles can still contain shouty phrases (e.g. SEPTEMBER or BREAKING).
  // Only change uppercase tokens; naturally cased names and sentences stay intact.
  return cleaned.replace(/[\p{L}]+(?:['’][\p{L}]+)*/gu, (word, offset: number) => {
    if (word !== word.toUpperCase() || word.length < 2) return word;
    const lower = word.toLowerCase();
    if (ACRONYMS.has(lower)) return word;
    if (offset > 0 && LOWERCASE_WORDS.has(lower)) return lower;
    if (lower.startsWith('mc') && lower.length > 3)
      return 'Mc' + lower[2].toUpperCase() + lower.slice(3);
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}
