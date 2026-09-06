export type ContentSourceKind = 'reporting' | 'official' | 'video' | 'social';

export type ContentSource = {
  id: string;
  teamAbbr: string;
  kind: ContentSourceKind;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  topicKey: string;
  importance?: number;
  imageUrl?: string | null;
};

export type BriefingSource = Pick<
  ContentSource,
  'id' | 'kind' | 'publisher' | 'title' | 'url' | 'publishedAt'
>;

export type TeamBriefing = {
  id: string;
  teamAbbr: string;
  category: string;
  headline: string;
  summary: string;
  whatHappened?: string;
  whyItMatters?: string | null;
  whatsNext?: string | null;
  imageUrl?: string | null;
  updatedAt: string;
  sourceCount: number;
  status?: string | null;
  materialUpdateCount?: number;
  hotReadUntil?: string | null;
  firstReportedBy?: string | null;
  sources: BriefingSource[];
};

export type BriefingListItem = Omit<TeamBriefing, 'sources'>;

export type SummarizedTopic = Pick<
  TeamBriefing,
  'category' | 'headline' | 'summary' | 'whatHappened' | 'whyItMatters' | 'whatsNext'
> & {
  sourceIds: string[];
};

export interface ContentSourceAdapter {
  collect(teamAbbr: string, teamName: string): Promise<ContentSource[]>;
}

export interface TopicSummarizer {
  summarize(args: {
    teamAbbr: string;
    teamName: string;
    topicKey: string;
    sources: ContentSource[];
  }): Promise<SummarizedTopic>;
}
