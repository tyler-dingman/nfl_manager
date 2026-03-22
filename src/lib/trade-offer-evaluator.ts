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

const PREMIUM_TRADE_RULES = {
  eliteMultiplier: 1.55,
  starMultiplier: 1.3,
  elitePenalty: 0.42,
  starPenalty: 0.6,
  junkBundlePenalty: 0.72,
} as const;

export const TRADE_ACCEPT_MARK_SCORE = TRADE_INTEREST_THRESHOLDS.low;
export const TRADE_ACCEPT_WIGGLE = Number((TRADE_ACCEPT_MARK_SCORE * 0.1).toFixed(3));

export const isWithinTradeAcceptWindow = (score: number) =>
  score >= TRADE_ACCEPT_MARK_SCORE - TRADE_ACCEPT_WIGGLE &&
  score <= TRADE_ACCEPT_MARK_SCORE + TRADE_ACCEPT_WIGGLE;

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
    return Number(
      (1 + incomingVeterans * 0.04 - incomingPicks * 0.02 + profile.prefersVeterans * 0.04).toFixed(
        3,
      ),
    );
  }
  if (context.contenderWindow === 'rebuild') {
    return Number(
      (1 + incomingPicks * 0.05 - incomingVeterans * 0.03 + profile.prefersPicks * 0.05).toFixed(3),
    );
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

const highestPlayerRating = (assets: TradeOfferAssetDTO[]) =>
  assets.reduce((max, asset) => {
    if (asset.type !== 'player') return max;
    return Math.max(max, asset.rating ?? 0);
  }, 0);

const pickValueTotal = (assets: TradeOfferAssetDTO[]) =>
  assets.reduce((sum, asset) => sum + (asset.type === 'pick' ? asset.projectedValuePoints : 0), 0);

const countPlayersAtOrAbove = (assets: TradeOfferAssetDTO[], rating: number) =>
  assets.filter((asset) => asset.type === 'player' && (asset.rating ?? 0) >= rating).length;

const countPremiumPicks = (assets: TradeOfferAssetDTO[], minimumProjectedValue: number) =>
  assets.filter(
    (asset) => asset.type === 'pick' && asset.projectedValuePoints >= minimumProjectedValue,
  ).length;

const premiumPlayerGuardrail = (incoming: TradeOfferAssetDTO[], outgoing: TradeOfferAssetDTO[]) => {
  const outgoingBestRating = highestPlayerRating(outgoing);
  const incomingBestRating = highestPlayerRating(incoming);
  const outgoingTotal = outgoing.reduce((sum, asset) => sum + asset.projectedValuePoints, 0);
  const incomingTotal = incoming.reduce((sum, asset) => sum + asset.projectedValuePoints, 0);
  const incomingPickValue = pickValueTotal(incoming);
  const incomingLowValueAssets = incoming.filter((asset) => asset.projectedValuePoints < 45).length;
  const incomingNinetyPlusPlayers = countPlayersAtOrAbove(incoming, 90);
  const incomingEightyEightPlusPlayers = countPlayersAtOrAbove(incoming, 88);
  const incomingBlueChipPicks = countPremiumPicks(incoming, 320);
  const incomingStrongPicks = countPremiumPicks(incoming, 220);

  if (outgoingBestRating >= 94) {
    const hasStrongCounter = incomingNinetyPlusPlayers >= 2;
    const hasPremiumPickSupport = incomingBlueChipPicks >= 2 || incomingPickValue >= 1200;
    let multiplier =
      incomingTotal >= outgoingTotal * PREMIUM_TRADE_RULES.eliteMultiplier
        ? 1
        : hasStrongCounter && hasPremiumPickSupport
          ? 0.72
          : PREMIUM_TRADE_RULES.elitePenalty;
    if (incomingBestRating < 90) {
      multiplier *= 0.72;
    }
    if (incomingNinetyPlusPlayers === 0 && incomingBlueChipPicks < 2) {
      multiplier *= 0.7;
    }
    if (incomingPickValue < 900) {
      multiplier *= 0.82;
    }
    if (incoming.length >= 3 && incomingLowValueAssets >= Math.ceil(incoming.length * 0.66)) {
      multiplier *= PREMIUM_TRADE_RULES.junkBundlePenalty;
    }
    return Number(multiplier.toFixed(3));
  }

  if (outgoingBestRating >= 90) {
    const hasPremiumPlayerSupport =
      incomingNinetyPlusPlayers >= 1 || incomingEightyEightPlusPlayers >= 2;
    const hasPremiumPickSupport = incomingStrongPicks >= 2 || incomingPickValue >= 650;
    let multiplier =
      incomingTotal >= outgoingTotal * PREMIUM_TRADE_RULES.starMultiplier
        ? 1
        : hasPremiumPlayerSupport && hasPremiumPickSupport
          ? 0.82
          : PREMIUM_TRADE_RULES.starPenalty;
    if (incomingBestRating < 88 && incomingPickValue < 750) {
      multiplier *= 0.78;
    }
    if (incomingNinetyPlusPlayers === 0 && incomingStrongPicks === 0) {
      multiplier *= 0.8;
    }
    if (incoming.length >= 3 && incomingLowValueAssets >= Math.ceil(incoming.length * 0.66)) {
      multiplier *= 0.84;
    }
    return Number(multiplier.toFixed(3));
  }

  if (
    incoming.length >= 4 &&
    incomingLowValueAssets >= Math.ceil(incoming.length * 0.75) &&
    outgoingTotal >= 300
  ) {
    return 0.86;
  }

  return 1;
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

export const getTradeAcceptanceLabel = labelFromBand;

export const probabilityFromTradeScore = (score: number) => {
  const normalized = 1 / (1 + Math.exp(-7.5 * (score - TRADE_ACCEPT_MARK_SCORE)));
  return Math.max(2, Math.min(99, Math.round(normalized * 100)));
};

const buildTradeExplanation = ({
  incoming,
  outgoing,
  context,
  score,
  guardrail,
  rawRatio,
  needFit,
  capFit,
}: {
  incoming: TradeOfferAssetDTO[];
  outgoing: TradeOfferAssetDTO[];
  context: TradeEvaluationContext;
  score: number;
  guardrail: number;
  rawRatio: number;
  needFit: number;
  capFit: number;
}) => {
  if (guardrail < 0.8) {
    return 'This still feels light for the premium talent or pick capital they would be giving up.';
  }
  if (capFit < 0.95) {
    return 'They like pieces of the return, but the cap impact still makes this tougher to justify.';
  }
  if (needFit > 1.05) {
    return `They value the fit at one of their key needs and view this as a close football trade.`;
  }
  if (score >= TRADE_INTEREST_THRESHOLDS.high) {
    return rawRatio >= 1.12
      ? 'The return is strong enough that this is becoming an easy yes for them.'
      : 'They like the framework and see enough balanced value to move quickly.';
  }
  if (score >= TRADE_INTEREST_THRESHOLDS.low) {
    return 'They believe this framework is close, but they still want a little more certainty in the return.';
  }
  if (pickValueTotal(outgoing) > 0 && incoming.some((asset) => asset.type === 'player')) {
    return 'They are interested, but the player-for-pick balance still is not where they want it.';
  }
  return 'Right now the return is not close enough to what they are sending back.';
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
  const guardrail = premiumPlayerGuardrail(incoming.assets, outgoing.assets);
  const blendedBase = rawRatio * needFit * rosterFit * windowFit * capFit * guardrail;
  const gmStyle = styleMultiplier(profile, blendedBase);
  const score = Number((blendedBase * gmStyle).toFixed(3));
  const band = bandFromScore(score);
  const probability = probabilityFromTradeScore(score);
  const delta = Number((incomingValue - outgoingValue).toFixed(1));

  return {
    score,
    band,
    label: labelFromBand(band),
    probability,
    delta,
    explanation: buildTradeExplanation({
      incoming: incoming.assets,
      outgoing: outgoing.assets,
      context,
      score,
      guardrail,
      rawRatio,
      needFit,
      capFit,
    }),
    components: {
      rawRatio: Number(rawRatio.toFixed(3)),
      needFit: Number(needFit.toFixed(3)),
      rosterFit: Number(rosterFit.toFixed(3)),
      windowFit: Number(windowFit.toFixed(3)),
      gmStyle: Number(gmStyle.toFixed(3)),
      capFit: Number(capFit.toFixed(3)),
      premiumGuardrail: Number(guardrail.toFixed(3)),
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
