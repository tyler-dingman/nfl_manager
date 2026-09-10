const CONFIRMED_TRADE =
  /\b(traded|acquired|dealt|completed? (?:a )?trade|finali[sz]ed (?:a )?trade|agreed to (?:a )?trade|trade (?:is )?official)\b/i;
const TRADE_TALK_CATEGORY =
  /\bTRADE(?:_|\s)+(?:TALK|RUMOU?RS?|DISCUSSIONS?|BUZZ|INTEREST)\b/i;
const SPECULATIVE_TRADE_LANGUAGE =
  /\b(trade talks?|trade discussions?|trade rumou?rs?|trade interest|requested a trade|on the trade block|listening to offers|exploring (?:a )?trade|could (?:be )?trade|may (?:be )?trade|might (?:be )?trade|interested in trading)\b/i;

export function shouldUseTradeTalkGraphic({
  category,
  headline,
  summary,
  status,
}: {
  category: string;
  headline?: string;
  summary?: string;
  status?: string | null;
}) {
  const taxonomy = category.trim().toUpperCase().replaceAll('_', ' ');
  const copy = `${headline ?? ''} ${summary ?? ''} ${status ?? ''}`;

  if (CONFIRMED_TRADE.test(copy)) return false;
  if (TRADE_TALK_CATEGORY.test(taxonomy)) return true;
  return taxonomy === 'TRADE' && SPECULATIVE_TRADE_LANGUAGE.test(copy);
}
