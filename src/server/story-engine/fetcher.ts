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

export class YouTubeSourceFetcher implements SourceFetcher {
  async fetch(source: RegisteredSource): Promise<FetchResult> {
    const channelId = String(source.metadata.youtubeChannelId ?? '');
    const uploadsPlaylistId = String(source.metadata.youtubeUploadsPlaylistId ?? '');
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (source.metadata.platform !== 'YOUTUBE' || !channelId || !uploadsPlaylistId)
      throw new Error(
        `Source ${source.id} is not configured with a canonical YouTube channel and uploads playlist ID.`,
      );
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not configured.');
    // playlistItems.list costs one quota unit; search.list costs 100. Resolve the
    // immutable uploads playlist once and use this low-cost endpoint for polling.
    const endpoint = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    endpoint.search = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '25',
      key: apiKey,
    }).toString();
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`YouTube source fetch failed with HTTP ${response.status}.`);
    const payload = (await response.json()) as any;
    const fetchedAt = new Date().toISOString();
    const items: RawSourceItem[] = (payload.items ?? []).map((item: any) => ({
      sourceId: source.id,
      externalId: item.contentDetails.videoId,
      url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
      title: item.snippet.title,
      author: item.snippet.channelTitle ?? null,
      publishedAt: item.snippet.publishedAt,
      updatedAt: null,
      rawText: item.snippet.description ?? '',
      excerpt: item.snippet.description ?? '',
      media: [
        { type: 'video', url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}` },
      ],
      fetchedAt,
    }));
    return { items, notModified: false, etag: response.headers.get('etag'), lastModified: null };
  }
}
