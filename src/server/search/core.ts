import { createHash } from 'node:crypto';

export const contentHash = (value: string) => createHash('sha256').update(value).digest('hex');

export function chunkText(text: string, maxCharacters = 1800, overlap = 240) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxCharacters);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end);
      if (boundary > start + maxCharacters / 2) end = boundary;
    }
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function reciprocalRankFusion(rankings: string[][], k = 60) {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}
