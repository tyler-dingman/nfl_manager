import type { FalcoTag } from '@/lib/falco';

export type PickLabel = 'VALUE' | 'REACH' | 'NEED' | 'SAFE' | 'BUST RISK';

export const getPickLabel = ({
  pickIndex,
  playerRank,
  teamNeeds,
  playerPosition,
  tags,
}: {
  pickIndex: number;
  playerRank: number;
  teamNeeds: string[];
  playerPosition: string;
  tags: FalcoTag[];
}): PickLabel => {
  if (tags.includes('Injury Flag') || tags.includes('Character Flag')) {
    return 'BUST RISK';
  }
  if (playerRank <= pickIndex - 5) {
    return 'VALUE';
  }
  if (playerRank >= pickIndex + 8) {
    return 'REACH';
  }
  if (teamNeeds.includes(playerPosition)) {
    return 'NEED';
  }
  return 'SAFE';
};

const valueQuotes = [
  'Five Wide: That’s board value. You don’t pass that up.',
  'Five Wide: At this pick, {player} is a steal.',
  'Five Wide: The card writes itself here. Pure value.',
  'Five Wide: That’s a clean win on the board.',
  'Five Wide: That’s how you stack value in round one.',
  'Five Wide: {team} just got a gift at {pick}.',
  'Five Wide: That’s a talent tier above this slot.',
  'Five Wide: {player} should’ve been gone earlier.',
  'Five Wide: Perfect timing. Great value.',
  'Five Wide: That’s a strong value pocket pick.',
];

const reachQuotes = [
  'Five Wide: That’s early. Traits are big, tape is thin.',
  'Five Wide: {team} is betting on projection there.',
  'Five Wide: That’s a reach by my board.',
  'Five Wide: Someone in the room fell in love with upside.',
  'Five Wide: That’s a swing at {pick}.',
  'Five Wide: The value didn’t line up on that one.',
  'Five Wide: Bold call. I had him later.',
  'Five Wide: {player} is good, but that’s early.',
  'Five Wide: I don’t see first-round value at this spot.',
  'Five Wide: That’s a stretch unless the fit is perfect.',
];

const needQuotes = [
  'Five Wide: That fits a top need and makes sense.',
  'Five Wide: Clean fit. {team} needed that piece.',
  'Five Wide: That’s smart roster math.',
  'Five Wide: {team} filled a real hole with that pick.',
  'Five Wide: Need and value aligned there.',
  'Five Wide: That’s a sensible team-build pick.',
  'Five Wide: {player} plugs a gap immediately.',
  'Five Wide: Good fit, good plan.',
  'Five Wide: That’s a roster win for {team}.',
  'Five Wide: Not flashy, but it solves a problem.',
];

const safeQuotes = [
  'Five Wide: Solid pick. High floor, steady returns.',
  'Five Wide: That’s a safe bet in round one.',
  'Five Wide: You know what you’re getting.',
  'Five Wide: Reliable tape, reliable projection.',
  'Five Wide: Good player, good slot.',
  'Five Wide: That’s a steady starter profile.',
  'Five Wide: No drama with that pick.',
  'Five Wide: {player} is a clean projection.',
  'Five Wide: That’s a firm, safe selection.',
  'Five Wide: Not wild, but it works.',
];

const riskQuotes = [
  'Five Wide: That’s a risk profile pick. Watch the flags.',
  'Five Wide: Talent is real, but the risk is loud.',
  'Five Wide: {team} is gambling on the upside.',
  'Five Wide: That’s a dice roll with a big ceiling.',
  'Five Wide: Boom or bust. No in-between.',
  'Five Wide: You’ll need patience with that profile.',
  'Five Wide: The floor is scary, the ceiling is real.',
  'Five Wide: That’s a high-variance pick.',
  'Five Wide: Not for the faint of heart.',
  'Five Wide: That’s a risk tolerance test.',
];

const gradeQuotes = [
  'Five Wide: That’s how you win a draft room.',
  'Five Wide: Love the value and the fit on that one.',
  'Five Wide: Smart pick, clean process.',
  'Five Wide: That’s a solid answer to a real need.',
  'Five Wide: You can build around picks like that.',
  'Five Wide: That’s a quiet steal.',
];

const pickQuote = (quotes: string[], vars: Record<string, string>) => {
  const quote = quotes[Math.floor(Math.random() * quotes.length)] ?? '';
  return quote.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
};

export const getFalcoReaction = ({
  label,
  teamAbbr,
  playerName,
  position,
  pickNumber,
}: {
  label: PickLabel;
  teamAbbr: string;
  playerName: string;
  position: string;
  pickNumber: number;
}): string => {
  const vars = {
    team: teamAbbr,
    player: playerName,
    position,
    pick: String(pickNumber),
  };
  if (label === 'VALUE') return pickQuote(valueQuotes, vars);
  if (label === 'REACH') return pickQuote(reachQuotes, vars);
  if (label === 'NEED') return pickQuote(needQuotes, vars);
  if (label === 'BUST RISK') return pickQuote(riskQuotes, vars);
  return pickQuote(safeQuotes, vars);
};

export const getFalcoGradeQuote = () => pickQuote(gradeQuotes, {});
