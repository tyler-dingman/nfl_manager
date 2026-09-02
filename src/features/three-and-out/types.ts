export type ThreeAndOutStoryStatus =
  | 'BREAKING'
  | 'DEVELOPING'
  | 'MOVING_UP'
  | 'HOLDING'
  | 'RESOLVED';

export type MediaStatus = 'NONE' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED' | 'STALE';

export type ThreeAndOutTeam = {
  id: string;
  slug: string;
  city: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  logo: string;
  timezone: string;
};

export type ThreeAndOutSource = {
  id: string;
  storyId: string;
  sourceName: string;
  authorName: string | null;
  sourceType: 'REPORTING' | 'OFFICIAL' | 'VIDEO' | 'SOCIAL' | 'DEVELOPMENT';
  sourceUrl: string;
  publishedAt: string;
  isOriginalReporter: boolean;
  isOfficialSource: boolean;
};

export type StoryScoreSignals = {
  footballImpact: number;
  sourceStrength: number;
  velocity: number;
  freshness: number;
  fanInterest: number;
  novelty: number;
};

export type ThreeAndOutStory = {
  id: string;
  teamId: string;
  title: string;
  shortTitle: string;
  summary: string;
  whyItMatters: string;
  whatsNext: string;
  status: ThreeAndOutStoryStatus;
  importanceScore: number;
  scoreSignals: StoryScoreSignals;
  previousRank: number | null;
  currentRank: number;
  createdAt: string;
  updatedAt: string;
  firstPublishedAt: string;
  lastMaterialUpdateAt: string;
  sourceCount: number;
  sources: ThreeAndOutSource[];
  newSinceLastVisit?: string | null;
  videoStatus: MediaStatus;
  audioStatus: MediaStatus;
};

export type FourthDownOption = { id: string; label: string; votes: number };

export type FourthDownQuestion = {
  id: string;
  teamId: string;
  question: string;
  options: FourthDownOption[];
  associatedStoryIds: string[];
};

export type ThreeAndOutSnapshot = {
  id: string;
  teamId: string;
  teamName: string;
  generatedAt: string;
  storyIds: [string, string, string];
  stories: [ThreeAndOutStory, ThreeAndOutStory, ThreeAndOutStory];
  puntStories: ThreeAndOutStory[];
  fourthDown: FourthDownQuestion;
  audioStatus: MediaStatus;
  audioUrl: string | null;
  audioDuration: number | null;
  audioGeneratedAt: string | null;
  audioScriptVersion: string;
  videoStatus: MediaStatus;
  videoUrl: string | null;
  videoThumbnail: string | null;
  videoDuration: number | null;
  videoGeneratedAt: string | null;
  videoSnapshotId: string | null;
};

export type HistoricalThreeAndOut = Pick<
  ThreeAndOutSnapshot,
  'id' | 'teamId' | 'teamName' | 'generatedAt' | 'storyIds'
> & { storyTitles: [string, string, string] };

export type ThreeAndOutPackage = {
  current: ThreeAndOutSnapshot;
  previous: HistoricalThreeAndOut[];
};

export type EditorialOverride = {
  storyId: string;
  action: 'PROMOTE' | 'DEMOTE' | 'PIN_FIRST' | 'REMOVE' | 'SET_STATUS' | 'EDIT';
  value?: string | number | Partial<ThreeAndOutStory>;
  editorId: string;
  createdAt: string;
};
