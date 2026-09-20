import { TEAM_LIST } from '@/data/teams';
import type { NewsEvidence } from './answer-data';

const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
const stop = new Set(
  'the and for are with what when where who how they their them this that next latest today news updates team football nfl about did does have play playing tell more please'.split(
    ' ',
  ),
);
export function relevantNews(query: string, news: NewsEvidence[], teamName: string) {
  const ignored = new Set([...stop, ...words(teamName)]);
  const terms = words(query).filter((t) => !ignored.has(t));
  return terms.length
    ? news.filter((n) =>
        terms.some((t) => words(`${n.title} ${n.summary} ${n.entities.join(' ')}`).includes(t)),
      )
    : [];
}
const teamEntities = new Set(
  TEAM_LIST.flatMap((t) => [t.name, t.abbr, t.name.split(' ').at(-1)!]).map((v) => v.toLowerCase()),
);
const meaningfulEntities = (n: NewsEvidence) =>
  n.entities.map((e) => e.toLowerCase().trim()).filter((e) => !teamEntities.has(e) && e !== 'nfl');
export function rankBriefingEvidence(news: NewsEvidence[], now: Date) {
  const valid = news.filter(
    (n) =>
      n.sources.some((s) => s.tier !== 'C' && s.reliability >= 0.75) &&
      Date.parse(n.publishedAt) <= now.getTime() + 60000 &&
      Date.parse(n.publishedAt) >= now.getTime() - 72 * 3600000,
  );
  const ranked = valid
    .map((n) => {
      const hours = (now.getTime() - Date.parse(n.publishedAt)) / 3600000;
      const tier = n.sources.some((s) => s.tier === 'A') ? 30 : 12;
      const importance = Math.min(100, n.importance <= 1 ? n.importance * 100 : n.importance);
      const impact = /injur|transaction|sign|release|starter|coach|breaking|trade/i.test(
        `${n.category} ${n.title}`,
      )
        ? 15
        : 0;
      return {
        news: n,
        score:
          importance +
          tier +
          impact +
          Math.max(0, 40 - hours * 0.7) +
          Math.min(3, n.independentSources) * 4,
      };
    })
    .sort((a, b) => b.score - a.score);
  // Cluster before choosing the window: duplicate coverage is not a new development.
  const clusters: NewsEvidence[] = [];
  for (const { news: n } of ranked) {
    const entities = meaningfulEntities(n);
    const duplicate = clusters.find(
      (s) =>
        s.id === n.id ||
        (s.category === n.category && entities.some((e) => meaningfulEntities(s).includes(e))),
    );
    if (duplicate) {
      duplicate.sources = [
        ...new Map([...duplicate.sources, ...n.sources].map((s) => [s.url, s])).values(),
      ].sort((a, b) => b.reliability - a.reliability);
      // Keep the additional report available to synthesis, not just in source cards.
      if (!duplicate.summary.includes(n.summary)) duplicate.summary += ` ${n.summary}`;
      continue;
    }
    clusters.push({ ...n, sources: [...n.sources].sort((a, b) => b.reliability - a.reliability) });
  }
  let windowHours = 24;
  while (
    windowHours < 72 &&
    clusters.filter((n) => now.getTime() - Date.parse(n.publishedAt) <= windowHours * 3600000)
      .length < 3
  )
    windowHours += 24;
  const selected = clusters
    .filter((n) => now.getTime() - Date.parse(n.publishedAt) <= windowHours * 3600000)
    .slice(0, 5);
  return { news: selected, windowHours };
}

export type SynthesisClaim = { text: string; evidenceIds: string[]; quotes: string[] };
/** Reject missing citations, fabricated quoted evidence, numbers and named entities.
 * Current schedule/odds/status facts are rendered deterministically, never through this model. */
export function validateSynthesis(
  claims: SynthesisClaim[],
  evidence: Array<{ id: string; content: string }>,
) {
  const byId = new Map(evidence.map((e) => [e.id, e.content]));
  if (!claims.length || claims.length > 8) return false;
  return claims.every((c) => {
    if (
      !c.text?.trim() ||
      c.text.length > 900 ||
      !c.evidenceIds?.length ||
      c.evidenceIds.some((id) => !byId.has(id)) ||
      !c.quotes?.length
    )
      return false;
    const support = c.evidenceIds.map((id) => byId.get(id)!).join(' ');
    if (c.quotes.some((q) => q.length < 12 || !support.includes(q))) return false;
    if ((c.text.match(/\d+(?:[.:/-]\d+)*%?/g) ?? []).some((n) => !support.includes(n)))
      return false;
    const proper = c.text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [];
    if (proper.some((name) => !support.includes(name))) return false;
    return !/\[|https?:|ignore.*instruct/i.test(c.text);
  });
}
