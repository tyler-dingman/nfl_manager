import type { DraftPickTradeInput, TradeChartModel, TradePickAssetDTO } from '@/types/trade-offers';

const CURRENT_DRAFT_YEAR = 2026;
const PICKS_PER_ROUND = 32;

type DraftChartConfig = {
  model: TradeChartModel;
  currentYear: number;
  futureYearDiscount: Record<number, number>;
  projectedRoundDiscount: Record<number, number>;
};

const CHART_CONFIG: DraftChartConfig = {
  model: 'drafttek-classic',
  currentYear: CURRENT_DRAFT_YEAR,
  futureYearDiscount: {
    0: 1,
    1: 0.72,
    2: 0.56,
    3: 0.44,
  },
  projectedRoundDiscount: {
    1: 1.08,
    2: 0.92,
    3: 0.8,
    4: 0.66,
    5: 0.54,
    6: 0.44,
    7: 0.36,
  },
};

// DraftTek-style anchor values tuned to a classic NFL trade chart curve.
const ROUND_SLOT_VALUES: Record<number, number[]> = {
  1: [
    3000, 2600, 2200, 1800, 1700, 1600, 1500, 1400, 1350, 1300, 1250, 1200, 1150, 1100, 1050,
    1000, 950, 900, 875, 850, 800, 780, 760, 740, 720, 700, 680, 660, 640, 620, 600, 590,
  ],
  2: [
    580, 560, 540, 520, 500, 480, 460, 440, 420, 400, 390, 380, 370, 360, 350, 340, 330, 320,
    310, 300, 290, 280, 270, 260, 250, 240, 230, 220, 210, 200, 190, 184,
  ],
  3: [
    180, 175, 170, 165, 160, 155, 150, 145, 140, 136, 132, 128, 124, 120, 116, 112, 108, 104,
    100, 96, 94, 92, 90, 88, 86, 84, 82, 80, 79, 78, 78, 77,
  ],
  4: [
    76, 74, 72, 70, 68, 66, 64, 62, 60, 58, 56, 54, 52, 50, 48, 46, 44, 42, 40, 39, 38, 37, 36,
    35, 34, 33, 32, 31, 30, 29, 28, 28,
  ],
  5: [
    27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15.5, 15, 14.5, 14, 13.5, 13, 12.5, 12, 11.5,
    11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6,
  ],
  6: [
    5.8, 5.6, 5.4, 5.2, 5, 4.8, 4.6, 4.4, 4.2, 4, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1,
    3, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.9, 1.8,
  ],
  7: [
    1.7, 1.6, 1.55, 1.5, 1.45, 1.4, 1.35, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1, 0.98, 0.96, 0.94,
    0.92, 0.9, 0.88, 0.86, 0.84, 0.82, 0.8, 0.78, 0.76, 0.74, 0.72, 0.7, 0.68, 0.66, 0.64,
  ],
};

const normalizeOverallSlot = (round: number, overallSlot?: number | null) => {
  if (typeof overallSlot === 'number' && overallSlot > 0) {
    return overallSlot;
  }
  const firstOverallForRound = (round - 1) * PICKS_PER_ROUND + 1;
  return firstOverallForRound + Math.floor(PICKS_PER_ROUND / 2);
};

const roundSlotIndex = (round: number, overallSlot: number) => {
  const start = (round - 1) * PICKS_PER_ROUND + 1;
  return Math.max(0, Math.min(PICKS_PER_ROUND - 1, overallSlot - start));
};

export const getPickTradeValue = (
  pick: Pick<DraftPickTradeInput, 'round' | 'overallSlot'>,
  chartModel: TradeChartModel = CHART_CONFIG.model,
) => {
  if (chartModel !== CHART_CONFIG.model) {
    throw new Error(`Unsupported trade chart model: ${chartModel}`);
  }
  const values = ROUND_SLOT_VALUES[pick.round];
  if (!values) {
    return 0;
  }
  const overallSlot = normalizeOverallSlot(pick.round, pick.overallSlot);
  return Number(values[roundSlotIndex(pick.round, overallSlot)].toFixed(1));
};

export const getFuturePickTradeValue = (
  pick: Pick<DraftPickTradeInput, 'year' | 'round' | 'projectedRound' | 'overallSlot'>,
  yearsOut = Math.max(0, pick.year - CHART_CONFIG.currentYear),
  projectedRound = pick.projectedRound ?? pick.round,
  chartModel: TradeChartModel = CHART_CONFIG.model,
) => {
  const baseProjectedRound = Math.max(1, Math.min(7, projectedRound));
  const projectedOverall = (baseProjectedRound - 1) * PICKS_PER_ROUND + 17;
  const baseValue = getPickTradeValue(
    { round: baseProjectedRound, overallSlot: pick.overallSlot ?? projectedOverall },
    chartModel,
  );
  const timeDiscount =
    CHART_CONFIG.futureYearDiscount[yearsOut] ??
    Math.max(0.3, CHART_CONFIG.futureYearDiscount[3] - (yearsOut - 3) * 0.06);
  const roundDiscount =
    CHART_CONFIG.projectedRoundDiscount[baseProjectedRound] ??
    CHART_CONFIG.projectedRoundDiscount[7];

  return Number((baseValue * timeDiscount * roundDiscount).toFixed(1));
};

export const sumPickPackageValue = (
  picks: Array<Pick<DraftPickTradeInput, 'year' | 'round' | 'overallSlot' | 'projectedRound'>>,
  chartModel: TradeChartModel = CHART_CONFIG.model,
) =>
  Number(
    picks
      .reduce((sum, pick) => {
        const yearsOut = Math.max(0, pick.year - CHART_CONFIG.currentYear);
        const value =
          yearsOut > 0
            ? getFuturePickTradeValue(pick, yearsOut, pick.projectedRound ?? pick.round, chartModel)
            : getPickTradeValue(pick, chartModel);
        return sum + value;
      }, 0)
      .toFixed(1),
  );

export const buildPickAsset = (pick: DraftPickTradeInput): TradePickAssetDTO => {
  const overallSlot = normalizeOverallSlot(pick.round, pick.overallSlot);
  const yearsOut = Math.max(0, pick.year - CHART_CONFIG.currentYear);
  const futureDiscount = yearsOut
    ? Number(
        (
          CHART_CONFIG.futureYearDiscount[yearsOut] ??
          Math.max(0.3, CHART_CONFIG.futureYearDiscount[3] - (yearsOut - 3) * 0.06)
        ).toFixed(2),
      )
    : 1;
  const projectedValuePoints = yearsOut
    ? getFuturePickTradeValue(
        {
          year: pick.year,
          round: pick.round,
          overallSlot,
          projectedRound: pick.projectedRound,
        },
        yearsOut,
        pick.projectedRound ?? pick.round,
      )
    : getPickTradeValue({ round: pick.round, overallSlot });

  return {
    id: `pick-${pick.owningTeamAbbr.toLowerCase()}-${pick.year}-r${pick.round}-${overallSlot}`,
    type: 'pick',
    label: `${pick.year} Round ${pick.round}${overallSlot ? ` · Pick ${overallSlot}` : ''}`,
    year: pick.year,
    round: pick.round,
    overallSlot,
    owningTeamAbbr: pick.owningTeamAbbr,
    originalTeamAbbr: pick.originalTeamAbbr ?? pick.owningTeamAbbr,
    projectedRound: pick.projectedRound ?? null,
    projectedValuePoints,
    futureDiscount,
  };
};

export const TRADE_CHART_CONFIG = CHART_CONFIG;
