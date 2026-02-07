import {
  falcoDraftReach,
  falcoDraftStandard,
  falcoDraftSteal,
  falcoFreeAgencyPositive,
  falcoFreeAgencyRisk,
  falcoResignNegative,
  falcoResignNeutral,
  falcoResignPositive,
  pickFalcoQuote,
} from '@/lib/falco-dialogue';

export type FalcoPhase = 'resign_cut' | 'free_agency' | 'draft' | 'season';

type PhaseSummaryInput = {
  phase: FalcoPhase;
  capSpace: number;
  rosterCount: number;
  rosterLimit: number;
  seed: string;
};

type PhaseSummaryResult = {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  quote: string;
  implication: string;
};

const implicationByPhase: Record<FalcoPhase, string> = {
  resign_cut: 'Free agency will test your discipline.',
  free_agency: 'The draft will punish empty rooms.',
  draft: 'Now the season will answer the work.',
  season: 'The results will speak soon.',
};

const gradeFromScore = (score: number): PhaseSummaryResult['grade'] => {
  if (score >= 85) return 'A';
  if (score >= 72) return 'B';
  if (score >= 58) return 'C';
  if (score >= 45) return 'D';
  return 'F';
};

const scorePhase = (capSpace: number, rosterCount: number, rosterLimit: number): number => {
  const capScore =
    capSpace >= 20 ? 40 : capSpace >= 10 ? 32 : capSpace >= 0 ? 24 : capSpace >= -10 ? 12 : 4;
  const rosterRatio = rosterLimit > 0 ? rosterCount / rosterLimit : 0;
  const rosterScore =
    rosterRatio >= 0.9 ? 30 : rosterRatio >= 0.8 ? 22 : rosterRatio >= 0.7 ? 16 : 10;
  const riskScore = capSpace < 0 ? 8 : 20;
  return Math.min(100, Math.max(0, capScore + rosterScore + riskScore));
};

const poolForPhase = (phase: FalcoPhase, grade: PhaseSummaryResult['grade']): string[] => {
  if (phase === 'resign_cut') {
    if (grade === 'A' || grade === 'B') return falcoResignPositive;
    if (grade === 'C') return falcoResignNeutral;
    return falcoResignNegative;
  }
  if (phase === 'free_agency') {
    if (grade === 'A' || grade === 'B') return falcoFreeAgencyPositive;
    return falcoFreeAgencyRisk;
  }
  if (phase === 'draft') {
    if (grade === 'A') return falcoDraftSteal;
    if (grade === 'B' || grade === 'C') return falcoDraftStandard;
    return falcoDraftReach;
  }
  return falcoResignNeutral;
};

export const buildPhaseSummary = (input: PhaseSummaryInput): PhaseSummaryResult => {
  const score = scorePhase(input.capSpace, input.rosterCount, input.rosterLimit);
  const grade = gradeFromScore(score);
  const pool = poolForPhase(input.phase, grade);
  const quote = pickFalcoQuote(pool, `${input.seed}:${input.phase}:${grade}`);
  const implication = implicationByPhase[input.phase];
  return { grade, quote, implication };
};
