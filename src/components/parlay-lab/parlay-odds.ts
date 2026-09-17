export function americanToDecimal(odds: number) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1));
}

export function estimateParlayOdds(legs: Array<number | null | undefined>) {
  const validOdds = legs.filter((odds): odds is number => typeof odds === 'number' && odds !== 0);
  if (!legs.length || validOdds.length !== legs.length) return null;
  const decimal = validOdds.reduce((combined, odds) => combined * americanToDecimal(odds), 1);
  return decimalToAmerican(decimal);
}

export function hypotheticalReturn(americanOdds: number | null | undefined, stake = 10) {
  if (americanOdds == null || americanOdds === 0 || !Number.isFinite(stake) || stake <= 0)
    return null;
  return Math.round(stake * americanToDecimal(americanOdds) * 100) / 100;
}

export function hypotheticalPortfolioResult(
  plays: Array<{
    status?: 'UPCOMING' | 'LIVE' | 'HIT' | 'MISSED' | 'VOID';
    odds?: number | null;
    hasVoidLeg?: boolean;
  }>,
  stake = 10,
) {
  let count = 0;
  let totalReturn = 0;

  for (const play of plays) {
    if (play.status === 'MISSED') {
      count += 1;
      continue;
    }
    if (play.status === 'VOID') {
      count += 1;
      totalReturn += stake;
      continue;
    }
    if (play.status !== 'HIT' || play.hasVoidLeg) continue;
    const returned = hypotheticalReturn(play.odds, stake);
    if (returned == null) continue;
    count += 1;
    totalReturn += returned;
  }

  const staked = count * stake;
  return {
    count,
    staked,
    totalReturn: Math.round(totalReturn * 100) / 100,
    net: Math.round((totalReturn - staked) * 100) / 100,
  };
}
