import type {
  TradeAssetPackage,
  TradeEvaluationContext,
  TradeFairnessBand,
  TradeOfferAssetDTO,
  TradeTeamProfile,
} from '@/types/trade-offers';

export const TRADE_INTEREST_THRESHOLDS = {
  reject: 0.82,
  low: 0.95,
  fair: 1.09,
  high: 1.21,
} as const;

const assetNeedFit = (assets: TradeOfferAssetDTO[], context: TradeEvaluationContext) => {
  if (assets.length === 0) return 1;
  const bonus = assets.reduce((sum, asset) => {
    if (asset.type !== 'player') return sum;
    const idx = context.needs.findIndex((need) => need === asset.position);
    if (idx === -1) return sum;
    return sum + (0.18 - idx * 0.03);
  }, 0);
  return Math.max(0.86, 1 + bonus / Math.max(assets.length, 1));
};

const rosterFitMultiplier = (incoming: TradeOfferAssetDTO[], outgoing: TradeOfferAssetDTO[]) => {
  const outgoingPlayers = outgoing.filter((asset) => asset.type === 'player').length;
  const incomingPlayers = incoming.filter((asset) => asset.type === 'player').length;
  const incomingPicks = incoming.filter((asset) => asset.type === 'pick').length;
  if (incomingPicks > outgoingPlayers && outgoingPlayers > incomingPlayers) {
    return 1.04;
  }
  if (incomingPlayers > outgoingPlayers + 1) {
    return 0.96;
  }
  return 1;
};

const windowMultiplier = (
  incoming: TradeOfferAssetDTO[],
  context: TradeEvaluationContext,
  profile: TradeTeamProfile,
) => {
  const incomingPicks = incoming.filter((asset) => asset.type === 'pick').length;
  const incomingVeterans = incoming.filter(
    (asset) => asset.type === 'player' && (asset.age ?? 27) >= 29,
  ).length;
  if (context.contenderWindow === 'win_now') {
    return Number((1 + incomingVeterans * 0.04 - incomingPicks * 0.02 + profile.prefersVeterans * 0.04).toFixed(3));
  }
  if (context.contenderWindow === 'rebuild') {
    return Number((1 + incomingPicks * 0.05 - incomingVeterans * 0.03 + profile.prefersPicks * 0.05).toFixed(3));
  }
  return 1;
};

const capFitMultiplier = (incoming: TradeOfferAssetDTO[], context: TradeEvaluationContext) => {
  const incomingCapHit = incoming.reduce((sum, asset) => {
    if (asset.type !== 'player') return sum;
    return sum + (Number(asset.capHit.replace(/[^0-9.]/g, '')) || 0);
  }, 0);
  if (context.capSpace < 6 && incomingCapHit > 12) return 0.88;
  if (context.capSpace < 10 && incomingCapHit > 18) return 0.93;
  return 1;
};

const styleMultiplier = (profile: TradeTeamProfile, bandBaseScore: number) => {
  const bias = 1 + profile.aggressive * 0.04 - profile.conservative * 0.03;
  if (bandBaseScore > 1.1) {
    return Number((bias + profile.overpayForStars * 0.02).toFixed(3));
  }
  return Number(bias.toFixed(3));
};

const totalValue = (pkg: TradeAssetPackage) =>
  pkg.totalValue > 0
    ? pkg.totalValue
    : pkg.assets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0);

export const bandFromScore = (score: number): TradeFairnessBand => {
  if (score < TRADE_INTEREST_THRESHOLDS.reject) return 'reject';
  if (score < TRADE_INTEREST_THRESHOLDS.low) return 'low_interest';
  if (score < TRADE_INTEREST_THRESHOLDS.fair) return 'fair';
  if (score < TRADE_INTEREST_THRESHOLDS.high) return 'high_interest';
  return 'smash_accept';
};

export const labelFromBand = (band: TradeFairnessBand) => {
  switch (band) {
    case 'reject':
      return 'Reject';
    case 'low_interest':
      return 'Low Interest';
    case 'fair':
      return 'Fair';
    case 'high_interest':
      return 'High Interest';
    case 'smash_accept':
      return 'Smash Accept';
  }
};

export const evaluateTradeForTeam = (
  incoming: TradeAssetPackage,
  outgoing: TradeAssetPackage,
  context: TradeEvaluationContext,
  profile: TradeTeamProfile,
) => {
  const outgoingValue = Math.max(1, totalValue(outgoing));
  const incomingValue = totalValue(incoming);
  const rawRatio = incomingValue / outgoingValue;
  const needFit = assetNeedFit(incoming.assets, context);
  const rosterFit = rosterFitMultiplier(incoming.assets, outgoing.assets);
  const windowFit = windowMultiplier(incoming.assets, context, profile);
  const capFit = capFitMultiplier(incoming.assets, context);
  const blendedBase = rawRatio * needFit * rosterFit * windowFit * capFit;
  const gmStyle = styleMultiplier(profile, blendedBase);
  const score = Number((blendedBase * gmStyle).toFixed(3));
  const band = bandFromScore(score);

  return {
    score,
    band,
    label: labelFromBand(band),
    components: {
      rawRatio: Number(rawRatio.toFixed(3)),
      needFit: Number(needFit.toFixed(3)),
      rosterFit: Number(rosterFit.toFixed(3)),
      windowFit: Number(windowFit.toFixed(3)),
      gmStyle: Number(gmStyle.toFixed(3)),
      capFit: Number(capFit.toFixed(3)),
    },
  };
};

export const gradeTradeOffer = (
  userIncoming: TradeAssetPackage,
  userOutgoing: TradeAssetPackage,
  userContext: TradeEvaluationContext,
  userProfile: TradeTeamProfile,
  aiIncoming: TradeAssetPackage,
  aiOutgoing: TradeAssetPackage,
  aiContext: TradeEvaluationContext,
  aiProfile: TradeTeamProfile,
) => {
  const user = evaluateTradeForTeam(userIncoming, userOutgoing, userContext, userProfile);
  const ai = evaluateTradeForTeam(aiIncoming, aiOutgoing, aiContext, aiProfile);

  return {
    user,
    ai,
  };
};
