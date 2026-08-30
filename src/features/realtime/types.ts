export type RealtimeStoryStatus = 'RUMOR' | 'DEVELOPING' | 'REPORTED' | 'CONFIRMED';
export type AudioDepth = 'quick' | 'coach' | 'knowBall';

export type StorySource = {
  id: string;
  name: string;
  role: string;
  url: string;
  publishedAt: string;
  trustTier: 1 | 2 | 3 | 4;
};

export type StoryAudio = {
  type: AudioDepth;
  label: string;
  durationSeconds: number;
  audioUrl?: string;
  script: string;
  generatedAt: string;
};

export type FanPulseSource = { platform: string; positivePercent: number; sampleSize: number };
export type FanPulseData = {
  status: 'GATHERING_REACTIONS' | 'EARLY_PULSE' | 'ESTABLISHED';
  overallMood: string;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
  sampleSize: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  topPositiveThemes: string[];
  topConcerns: string[];
  biggestDebate: string;
  trendingTake: string;
  sourceBreakdown: FanPulseSource[];
  lastAnalyzedAt: string;
};

export type StoryVideo = {
  id: string;
  category: 'QUICK TAKES' | 'DEEPER BREAKDOWNS' | 'PRESS CONFERENCES' | 'PLAYER FILM';
  title: string;
  creator: string;
  duration: string;
  url: string;
  usefulnessScore: number;
};

export type TimelineItem = { id: string; time: string; label: string; status: RealtimeStoryStatus };

export type StoryVerdict = {
  label: string;
  positivePercent: number;
  consensus: string;
  optimists: string;
  skeptics: string;
  smartestPoint: string;
  bottomLine: string;
};

export type RealtimeStory = {
  id: string;
  teamId: string;
  headline: string;
  slug: string;
  status: RealtimeStoryStatus;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string;
  eventOccurredAt: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  whatsNext: string;
  sources: StorySource[];
  trustLevel: string;
  audio: StoryAudio[];
  fanPulse: FanPulseData;
  videos: StoryVideo[];
  videoConsensus: string;
  timeline: TimelineItem[];
  verdict?: StoryVerdict;
  tags: string[];
  players: string[];
  storyType: string;
  importance: number;
  isBreaking: boolean;
  demo: boolean;
};

export type CatchMeUpData = {
  teamId: string;
  since: string;
  storyCount: number;
  durationSeconds: number;
  script: string;
  storyIds: string[];
};
