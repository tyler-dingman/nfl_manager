import type { SearchResult } from '@/features/search/types';

const MAX_ANSWER_RESULTS = 3;
const MAX_SUMMARY_LENGTH = 280;

const cleanExcerpt = (value: string) => {
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/(?:\s+#[\p{L}\p{N}_-]+)+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= MAX_SUMMARY_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_SUMMARY_LENGTH).replace(/\s+\S*$/, '')}…`;
};

/**
 * Builds a zero-inference-cost answer using only retrieved, already-published records.
 * It intentionally does not combine facts or make conclusions the source records did not make.
 */
export function buildDeterministicSearchAnswer(query: string, results: SearchResult[]) {
  const supported = results
    .map((result, index) => ({ result, sourceNumber: index + 1 }))
    .filter(({ result }) => Boolean(result.title.trim() && result.summary.trim()))
    .slice(0, MAX_ANSWER_RESULTS);
  if (!supported.length) return undefined;

  const lines = supported.map(
    ({ result, sourceNumber }) =>
      `• ${result.title}: ${cleanExcerpt(result.summary)} [${sourceNumber}]`,
  );
  return `Here are the strongest Down & Distance matches for “${query.trim()}”:\n\n${lines.join('\n')}`;
}
