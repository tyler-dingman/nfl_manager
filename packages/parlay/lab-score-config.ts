/** Evidence-weighted model parameters. Composite scores are not calibrated probabilities. */
export const LAB_SCORE_CONFIG = {
  version: 'weighted-evidence-v2-display-plus5',
  displayOffset: 5,
  trending: { overShare: 0.7, minimumScore: 60 },
  weights: {
    edge: 0.25,
    recent: 0.25,
    matchup: 0.2,
    opportunity: 0.15,
    history: 0.1,
    environment: 0.05,
  },
  history: {
    limit: 40,
    halfLifeDays: 42,
    recencyFloor: 0.2,
    similarityPower: 4,
    comparable: 0.6,
    minimum: 3,
    strong: 6,
    elite: 8,
  },
  opportunity: {
    recentGames: 3,
    baselineGames: 10,
    efficiencyPriorUnits: 12,
    redistribution: 0.8,
    depthPrior: 2,
    replacementBlend: 0.4,
    committeeRatio: 0.75,
    committeeMinimum: 3,
  },
  roleChange: {
    minor: 0.15,
    moderate: 0.3,
    major: 0.6,
    minimumVolume: 2,
    snapShareFloor: 0.1,
    conflictHours: 24,
  },
  freshnessHours: { official_injury: 72, inactive: 24, depth: 168, report: 72, usage: 336 },
  sourcePriority: { official_injury: 0, inactive: 1, depth: 2, report: 3, usage: 4 },
  adjustments: {
    matchup: 0.08,
    spread: 0.08,
    total: 0.04,
    neutralTotal: 44,
    spreadScale: 14,
    totalScale: 14,
  },
  signals: {
    strong: 0.65,
    elite: 0.8,
    strongGroups: 3,
    eliteGroups: 4,
    edgeScale: 1.5,
    varianceFloor: 0.2,
  },
  bands: [
    {
      min: 95,
      label: 'EXCEPTIONAL',
      range: '95–99',
      description: 'Exceptional statistical support.',
    },
    { min: 90, label: 'VERY HIGH', range: '90–94', description: 'Very strong opportunity.' },
    { min: 85, label: 'HIGH', range: '85–89', description: 'High modeled confidence.' },
    { min: 80, label: 'STRONG', range: '80–84', description: 'Multiple favorable indicators.' },
    { min: 70, label: 'FAVORABLE', range: '70–79', description: 'Positive but imperfect support.' },
    { min: 60, label: 'NEUTRAL', range: '60–69', description: 'Mixed indicators.' },
    { min: 50, label: 'WEAK', range: '50–59', description: 'Limited statistical support.' },
    { min: 0, label: 'POOR', range: '0–49', description: 'Unfavorable or insufficient evidence.' },
  ],
} as const;
export const labScoreBand = (score: number) =>
  LAB_SCORE_CONFIG.bands.find((b) => score >= b.min) ?? LAB_SCORE_CONFIG.bands[7];

/** Semantic score colors on Parlay Lab's dark surfaces; independent of team colors. */
export function labScoreColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '#9DB4C6';
  if (score >= 90) return '#00E99A';
  if (score >= 80) return '#4ADE80';
  if (score >= 70) return '#A3E635';
  if (score >= 60) return '#FBBF24';
  if (score >= 50) return '#FB7185';
  return '#FF4D64';
}

/** Presentation scale only; model evidence and probability remain unchanged. */
export function displayLabScore(modelScore: number, hasEvidence = true) {
  if (!hasEvidence || !Number.isFinite(modelScore) || modelScore <= 0) return 0;
  return Math.min(99, Math.round(modelScore) + LAB_SCORE_CONFIG.displayOffset);
}

export const LAB_SCORE_SCALE_NOTE = `The display scale adds ${LAB_SCORE_CONFIG.displayOffset} points to evidence-backed model scores, capped at 99. Projections and estimated hit probabilities are unchanged.`;
