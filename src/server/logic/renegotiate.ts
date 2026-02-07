import type { PlayerRowDTO } from '@/types/player';

import { estimateRenegotiateScore } from '@/lib/renegotiate-scoring';
import { getRenegotiateQuote } from '@/lib/renegotiate-quotes';

const parseCapHit = (capHit: string | undefined) => {
  if (!capHit) return 0;
  const cleaned = capHit.replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  return Number.isNaN(value) ? 0 : value;
};

export const evaluateRenegotiateOffer = ({
  saveId,
  player,
  years,
  apy,
  guaranteed,
}: {
  saveId: string;
  player: PlayerRowDTO;
  years: number;
  apy: number;
  guaranteed: number;
}) => {
  const age = player.age ?? 27;
  const rating = player.rating ?? 75;
  const currentApy =
    player.contract?.apy ?? player.salary ?? player.capHitValue ?? parseCapHit(player.capHit);
  const yearsRemaining = player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1;
  const currentGuaranteed = player.contract?.guaranteed ?? player.guaranteed ?? 0;
  const seed = `${saveId}-${player.id}-${years}-${apy}-${guaranteed}`;

  const estimate = estimateRenegotiateScore({
    age,
    rating,
    yearsRemaining,
    currentApy,
    currentGuaranteed,
    years,
    apy,
    guaranteed,
    seed,
  });

  const accepted = estimate.score >= 90;
  const quote = getRenegotiateQuote(accepted, seed);

  return {
    accepted,
    score: estimate.score,
    label: estimate.label,
    quote,
    insult: estimate.insult,
  };
};
