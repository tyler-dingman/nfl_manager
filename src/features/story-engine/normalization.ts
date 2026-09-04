import { createHash } from 'node:crypto';
import { TEAM_LIST } from '@/data/teams';
import type { EventType } from '@/features/source-engine/types';
import type { ContentCandidate, RawSourceItem, RegisteredSource } from './types';

const decode = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
export const stripMarkup = (value: string) =>
  decode(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const normalizeTitle = (value: string) =>
  stripMarkup(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const canonicalizeUrl = (value: string) => {
  const url = new URL(value);
  url.hash = '';
  [...url.searchParams.keys()]
    .filter((key) => key.startsWith('utm_') || ['ref', 'source', 'fbclid', 'gclid'].includes(key))
    .forEach((key) => url.searchParams.delete(key));
  return url.toString().replace(/\/$/, '');
};
export const contentFingerprint = (item: Pick<RawSourceItem, 'title' | 'rawText' | 'excerpt'>) =>
  createHash('sha256')
    .update(
      `${normalizeTitle(item.title)}|${stripMarkup(item.rawText || item.excerpt).toLowerCase()}`,
    )
    .digest('hex');

const eventPatterns: Array<[EventType, RegExp]> = [
  ['TRADE', /\btrade[ds]?|acquir(?:e|es|ed)\b/i],
  ['SIGNING', /\bsign(?:s|ed|ing)?\b/i],
  ['RELEASE', /\breleas(?:e|es|ed)|waiv(?:e|es|ed)|cut\b/i],
  ['INJURY', /\binjur|questionable|doubtful|ruled out|limited practice\b/i],
  ['SUSPENSION', /\bsuspend|suspension\b/i],
  ['CONTRACT', /\bcontract|extension|restructure\b/i],
  ['DRAFT', /\bdraft|prospect|pick\b/i],
  ['COACHING', /\bcoach|coordinator|hired|fired\b/i],
  ['GAME', /\bscore|defeat|win over|loss to|game recap\b/i],
  ['PRACTICE', /\bpractice|training camp\b/i],
  ['DEPTH_CHART', /\bdepth chart|starter|starting job\b/i],
  ['ROSTER', /\broster|practice squad\b/i],
];

export const classifyStoryType = (text: string): EventType =>
  eventPatterns.find(([, pattern]) => pattern.test(text))?.[0] ?? 'ANALYSIS';

const aliases = TEAM_LIST.map((team) => ({
  id: team.abbr,
  patterns: [team.name, team.abbr, team.name.split(' ').at(-1) ?? ''].filter(
    (value) => value.length > 2,
  ),
}));

export function matchTeams(text: string, source: RegisteredSource) {
  const matched = new Set<string>();
  // Discovery-tier aggregators often cover the entire league despite being registered from a
  // team catalog. Require an explicit team mention so unrelated league items cannot publish.
  if (source.teamId && source.pollingTier !== 'C') matched.add(source.teamId);
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  for (const team of aliases)
    if (
      team.patterns.some((alias) =>
        haystack.includes(` ${alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `),
      )
    )
      matched.add(team.id);
  return [...matched];
}

export function extractEntities(text: string) {
  const names = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) ?? [];
  return [...new Set(names)].slice(0, 20);
}

export function normalizeRawItem(raw: RawSourceItem, source: RegisteredSource): ContentCandidate {
  const text = stripMarkup(raw.rawText || raw.excerpt);
  const combined = `${raw.title} ${text}`;
  return {
    sourceId: source.id,
    externalId: raw.externalId,
    url: canonicalizeUrl(raw.url),
    title: stripMarkup(raw.title),
    normalizedTitle: normalizeTitle(raw.title),
    author: raw.author,
    publishedAt: raw.publishedAt,
    discoveredAt: raw.fetchedAt,
    text,
    excerpt: stripMarkup(raw.excerpt).slice(0, 1200),
    entities: extractEntities(combined),
    candidateTeams: matchTeams(combined, source),
    fingerprint: contentFingerprint(raw),
    status: 'NEW',
    storyType: classifyStoryType(combined),
  };
}
