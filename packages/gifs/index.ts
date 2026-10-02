export type GifReference = { mediaType: 'gif'; provider: 'klipy'; providerMediaId: string };
export type GifItem = {
  id: string;
  provider: 'klipy';
  title: string;
  previewUrl: string;
  stillUrl: string;
  mediaUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  providerUrl: string;
  attribution: string;
};
export type GifPage = { items: GifItem[]; cursor?: string };
export interface GifProvider {
  search(query: string, cursor?: string, signal?: AbortSignal): Promise<GifPage>;
  trending(cursor?: string, signal?: AbortSignal): Promise<GifPage>;
  getById(id: string, signal?: AbortSignal): Promise<GifItem | null>;
  share(id: string, query?: string): Promise<void>;
}
export const GIF_CHIPS = [
  ['Trending', ''],
  ['Reactions', 'reaction'],
  ['Celebrations', 'celebration'],
  ['Football', 'football'],
  ['Memes', 'memes'],
] as const;
export function gifReference(value: unknown): GifReference {
  const v = value as Partial<GifReference> | null;
  if (
    !v ||
    v.mediaType !== 'gif' ||
    v.provider !== 'klipy' ||
    typeof v.providerMediaId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,160}$/.test(v.providerMediaId)
  )
    throw Error('Invalid GIF reference.');
  // Never retain URLs, HTML, titles or renditions supplied by a message sender.
  return { mediaType: 'gif', provider: 'klipy', providerMediaId: v.providerMediaId };
}
export const toGifReference = (gif: GifItem): GifReference =>
  gifReference({ mediaType: 'gif', provider: gif.provider, providerMediaId: gif.id });
export function klipyMediaUrl(value: unknown): string {
  if (typeof value !== 'string') throw Error('Invalid GIF media.');
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    !['static.klipy.com', 'static1.klipy.com', 'static2.klipy.com'].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error('Invalid GIF media.');
  return value; // Preserve the provider's entire URL, including delivery parameters.
}
