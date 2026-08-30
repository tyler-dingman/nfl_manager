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
  'Down & Distance: That’s board value. You don’t pass that up.',
  'Down & Distance: At this pick, {player} is a steal.',
  'Down & Distance: The card writes itself here. Pure value.',
  'Down & Distance: That’s a clean win on the board.',
  'Down & Distance: That’s how you stack value in round one.',
  'Down & Distance: {team} just got a gift at {pick}.',
  'Down & Distance: That’s a talent tier above this slot.',
  'Down & Distance: {player} should’ve been gone earlier.',
  'Down & Distance: Perfect timing. Great value.',
  'Down & Distance: That’s a strong value pocket pick.',
];

const reachQuotes = [
  'Down & Distance: That’s early. Traits are big, tape is thin.',
  'Down & Distance: {team} is betting on projection there.',
  'Down & Distance: That’s a reach by my board.',
  'Down & Distance: Someone in the room fell in love with upside.',
  'Down & Distance: That’s a swing at {pick}.',
  'Down & Distance: The value didn’t line up on that one.',
  'Down & Distance: Bold call. I had him later.',
  'Down & Distance: {player} is good, but that’s early.',
  'Down & Distance: I don’t see first-round value at this spot.',
  'Down & Distance: That’s a stretch unless the fit is perfect.',
];

const needQuotes = [
  'Down & Distance: That fits a top need and makes sense.',
  'Down & Distance: Clean fit. {team} needed that piece.',
  'Down & Distance: That’s smart roster math.',
  'Down & Distance: {team} filled a real hole with that pick.',
  'Down & Distance: Need and value aligned there.',
  'Down & Distance: That’s a sensible team-build pick.',
  'Down & Distance: {player} plugs a gap immediately.',
  'Down & Distance: Good fit, good plan.',
  'Down & Distance: That’s a roster win for {team}.',
  'Down & Distance: Not flashy, but it solves a problem.',
];

const safeQuotes = [
  'Down & Distance: Solid pick. High floor, steady returns.',
  'Down & Distance: That’s a safe bet in round one.',
  'Down & Distance: You know what you’re getting.',
  'Down & Distance: Reliable tape, reliable projection.',
  'Down & Distance: Good player, good slot.',
  'Down & Distance: That’s a steady starter profile.',
  'Down & Distance: No drama with that pick.',
  'Down & Distance: {player} is a clean projection.',
  'Down & Distance: That’s a firm, safe selection.',
  'Down & Distance: Not wild, but it works.',
];

const riskQuotes = [
  'Down & Distance: That’s a risk profile pick. Watch the flags.',
  'Down & Distance: Talent is real, but the risk is loud.',
  'Down & Distance: {team} is gambling on the upside.',
  'Down & Distance: That’s a dice roll with a big ceiling.',
  'Down & Distance: Boom or bust. No in-between.',
  'Down & Distance: You’ll need patience with that profile.',
  'Down & Distance: The floor is scary, the ceiling is real.',
  'Down & Distance: That’s a high-variance pick.',
  'Down & Distance: Not for the faint of heart.',
  'Down & Distance: That’s a risk tolerance test.',
];

const gradeQuotes = [
  'Down & Distance: That’s how you win a draft room.',
  'Down & Distance: Love the value and the fit on that one.',
  'Down & Distance: Smart pick, clean process.',
  'Down & Distance: That’s a solid answer to a real need.',
  'Down & Distance: You can build around picks like that.',
  'Down & Distance: That’s a quiet steal.',
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
