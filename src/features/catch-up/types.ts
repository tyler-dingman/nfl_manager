import type { ThreeAndOutSource, ThreeAndOutStoryStatus } from '@/features/three-and-out/types';

export type CatchUpItemType = 'NEW' | 'CHANGED' | 'RESOLVED';

export type CatchUpStoryState = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  status: ThreeAndOutStoryStatus;
  importanceScore: number;
  rank: number;
  inThreeAndOut: boolean;
  lastMaterialUpdateAt: string;
  sourceCount: number;
  sources: ThreeAndOutSource[];
  fingerprint: string;
};

export type CatchUpItem = {
  id: string;
  storyId: string;
  teamId: string;
  type: CatchUpItemType;
  headline: string;
  summary: string;
  whatChanged: string | null;
  whyItMatters: string;
  occurredAt: string;
  importanceScore: number;
  sourceCount: number;
  sources: ThreeAndOutSource[];
  currentStoryStatus: ThreeAndOutStoryStatus;
};

export type CatchUpResponse = {
  eligible: boolean;
  teamId: string;
  teamName: string;
  baselineAt: string;
  currentSnapshotId: string;
  mode: 'CHANGES' | 'CURRENT_STATE';
  items: CatchUpItem[];
  totalMeaningfulChanges: number;
  estimatedReadMinutes: number;
};
