import type { RawSourceItem, RegisteredSource } from './types';
import { stripMarkup } from './normalization';

const first = (xml: string, names: string[]) => {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) return stripMarkup(match[1]);
  }
  return '';
};
const attr = (xml: string, tag: string, name: string) =>
  xml.match(new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']+)["'][^>]*>`, 'i'))?.[1] ?? '';

export function parseRssOrAtom(
  xml: string,
  source: RegisteredSource,
  fetchedAt = new Date().toISOString(),
): RawSourceItem[] {
  if (!/<(?:rss|feed|rdf:RDF)(?:\s|\/?>)/i.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('Invalid or unsupported RSS/Atom document.');
  if (
    !(
      /<rss\b[\s\S]*<\/rss\s*>/i.test(xml) ||
      /<feed\b[\s\S]*<\/feed\s*>/i.test(xml) ||
      /<feed\b[^>]*\/>\s*$/i.test(xml) ||
      /<rdf:RDF\b[\s\S]*<\/rdf:RDF\s*>/i.test(xml)
    )
  )
    throw new Error('Incomplete RSS/Atom document.');
  const structure = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, '');
  for (const tag of ['item', 'entry', 'channel'])
    if (
      (structure.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi')) ?? []).length !==
      (structure.match(new RegExp(`</${tag}\\s*>`, 'gi')) ?? []).length
    )
      throw new Error('Incomplete RSS/Atom content.');
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(
    (match) => match[2],
  );
  return blocks.flatMap((block) => {
    const title = first(block, ['title']);
    const url = first(block, ['link']) || attr(block, 'link', 'href');
    if (!title || !url) return [];
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) return [];
    } catch {
      return [];
    }
    const publishedAt = first(block, ['pubDate', 'published', 'updated']) || fetchedAt;
    if (!Number.isFinite(new Date(publishedAt).getTime())) return [];
    const excerpt = first(block, ['description', 'summary', 'content:encoded', 'content']);
    const externalId = first(block, ['guid', 'id']) || url;
    return [
      {
        sourceId: source.id,
        externalId,
        url,
        title,
        author: first(block, ['author', 'dc:creator']) || null,
        publishedAt: new Date(publishedAt).toISOString(),
        updatedAt: first(block, ['updated']) || null,
        rawText: excerpt,
        excerpt,
        media: [],
        fetchedAt,
      },
    ];
  });
}
