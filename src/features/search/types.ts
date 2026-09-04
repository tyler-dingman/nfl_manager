export type SearchResultType =
  | 'story'
  | 'article'
  | 'video'
  | 'press_conference'
  | 'podcast'
  | 'player'
  | 'injury'
  | 'game'
  | 'roster'
  | 'other';

export type SearchResult = {
  id: string;
  teamId: string | null;
  type: SearchResultType;
  title: string;
  summary: string;
  url: string;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  image: string | null;
  score: number;
  canonicalStoryId: string | null;
  metadata: Record<string, unknown>;
};

export type SearchResponse = {
  query: string;
  answer?: string;
  results: SearchResult[];
  sources: Array<{ id: string; title: string; url: string }>;
  timing: { totalMs: number; lexicalMs: number; vectorMs: number | null; answerMs: number | null };
};

export type IndexDocument = Omit<SearchResult, 'score'> & {
  sourceType: string;
  sourceId: string;
  content: string;
};
