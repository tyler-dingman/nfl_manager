import { isIP } from 'node:net';
import { SOURCE_FETCH_TIMEOUT_MS } from '@/features/story-engine/config';
import { parseRssOrAtom } from '@/features/story-engine/rss';
import type { RawSourceItem, RegisteredSource } from '@/features/story-engine/types';

const blockedHosts = new Set(['localhost', 'localhost.localdomain']);
export function assertSafeRegisteredUrl(value: string, source: RegisteredSource) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Unsupported source URL protocol.');
  if (blockedHosts.has(url.hostname) || url.hostname.endsWith('.local'))
    throw new Error('Private source hosts are not allowed.');
  const ipVersion = isIP(url.hostname);
  if (
    ipVersion &&
    (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname) ||
      url.hostname === '::1')
  )
    throw new Error('Private source addresses are not allowed.');
  const allowed = [source.url, source.feedUrl]
    .filter(Boolean)
    .some((registered) => new URL(registered!).hostname === url.hostname);
  if (!allowed) throw new Error('URL is not allowlisted for this source.');
  return url;
}

export type FetchResult = {
  items: RawSourceItem[];
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
};
export interface SourceFetcher {
  fetch(source: RegisteredSource): Promise<FetchResult>;
}

export class RssSourceFetcher implements SourceFetcher {
  async fetch(source: RegisteredSource): Promise<FetchResult> {
    if (source.fetchStrategy !== 'RSS' || !source.feedUrl)
      throw new Error(`Source ${source.id} is not configured for RSS.`);
    const url = assertSafeRegisteredUrl(source.feedUrl, source);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'DownDistanceSourceWatcher/1.0 (+https://downdistance.com)',
      };
      if (source.etag) headers['If-None-Match'] = source.etag;
      if (source.lastModified) headers['If-Modified-Since'] = source.lastModified;
      const response = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
      if (response.status === 304)
        return {
          items: [],
          notModified: true,
          etag: source.etag,
          lastModified: source.lastModified,
        };
      if (!response.ok) throw new Error(`Source fetch failed with HTTP ${response.status}.`);
      const finalUrl = assertSafeRegisteredUrl(response.url, source);
      void finalUrl;
      const xml = await response.text();
      return {
        items: parseRssOrAtom(xml, source),
        notModified: false,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
