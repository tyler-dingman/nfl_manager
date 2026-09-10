import type { SearchResult } from '@/features/search/types';

const MAX_ANSWER_RESULTS = 3;
const MAX_SUMMARY_LENGTH = 280;

const STOP_WORDS = new Set([
  'about',
  'are',
  'does',
  'for',
  'how',
  'the',
  'their',
  'what',
  'when',
  'where',
  'who',
  'why',
]);

const cleanExcerpt = (value: string) => {
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/(?:\s+#[\p{L}\p{N}_-]+)+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= MAX_SUMMARY_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_SUMMARY_LENGTH).replace(/\s+\S*$/, '')}…`;
};

const queryTerms = (query: string) =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

const answerExcerpt = (query: string, result: SearchResult) => {
  const terms = queryTerms(query);
  const sentences = cleanExcerpt(result.summary)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  if (!sentences.length) return '';

  return sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: terms.reduce(
        (score, term) => score + (sentence.toLowerCase().includes(term) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0].sentence;
};

/**
 * Builds a zero-inference-cost answer using only retrieved, already-published records.
 * It intentionally extracts the most query-relevant published statement instead of presenting
 * search-result cards as an answer. This keeps the response direct without inventing facts.
 */
export function buildDeterministicSearchAnswer(query: string, results: SearchResult[]) {
  const supported = results
    .map((result, index) => ({
      excerpt: answerExcerpt(query, result),
      sourceNumber: index + 1,
    }))
    .filter(({ excerpt }) => Boolean(excerpt))
    .slice(0, MAX_ANSWER_RESULTS);
  if (!supported.length) return undefined;

  return supported.map(({ excerpt, sourceNumber }) => `${excerpt} [${sourceNumber}]`).join(' ');
}
