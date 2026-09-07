import type { VideoSourceCategory, VideoSourceStatus } from '@/data/sources/types';

export type VideoSourceCandidate = {
  id: string;
  name: string;
  teamId: string | null;
  category: VideoSourceCategory;
  tags: VideoSourceCategory[];
  scope: 'team' | 'league';
  multiTeam: boolean;
  priority: 1 | 2 | 3;
  sourceWeight: number;
  candidateUrl?: string;
  youtubeChannelId?: string;
  youtubeHandle?: string;
  youtubeUrl?: string;
  status: VideoSourceStatus;
  reviewReason: string | null;
};
