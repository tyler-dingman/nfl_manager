export type InjuryGraphicCopy = {
  eyebrow: string;
  primaryText: string;
  accentText: string;
};

export function getInjuryGraphicCopy({
  headline = '',
  summary = '',
  status = '',
}: {
  headline?: string;
  summary?: string;
  status?: string | null;
}): InjuryGraphicCopy {
  const text = `${headline} ${summary} ${status}`.toUpperCase();
  const weeks = text.match(/(?:OUT|MISS(?:ES|ING)?)[^.!?]{0,36}?(\d+(?:\s*[-–]\s*\d+)?)\s+WEEKS?/);
  if (weeks)
    return { eyebrow: 'INJURY REPORT', primaryText: 'OUT', accentText: `${weeks[1]} WEEKS` };
  if (/\b(QUESTIONABLE|DOUBTFUL|GAME[- ]TIME DECISION)\b/.test(text))
    return { eyebrow: 'INJURY REPORT', primaryText: 'GAME', accentText: 'STATUS' };
  if (/\b(PRACTICE|DNP|LIMITED|DID NOT PARTICIPATE)\b/.test(text))
    return { eyebrow: 'INJURY REPORT', primaryText: 'STATUS', accentText: 'WATCH' };
  return { eyebrow: 'INJURY REPORT', primaryText: 'INJURY', accentText: 'ALERT' };
}
