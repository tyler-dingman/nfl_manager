export type YouTubeChannelSearchResult = {
  id?: { channelId?: string };
  snippet?: { channelId?: string; channelTitle?: string; title?: string };
};

export function normalizeYouTubeChannelName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function exactApprovedChannelMatch(
  approvedName: string,
  results: YouTubeChannelSearchResult[],
) {
  const expected = normalizeYouTubeChannelName(approvedName);
  const matches = results.filter((result) => {
    const actual = result.snippet?.channelTitle ?? result.snippet?.title ?? '';
    return normalizeYouTubeChannelName(actual) === expected;
  });
  return matches.length === 1 ? matches[0] : null;
}

export function videoResolutionPriority(category: string) {
  if (category === 'official') return 0;
  if (category === 'podcast') return 1;
  if (category === 'film') return 2;
  return 3;
}
