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
  'Falco: That’s board value. You don’t pass that up.',
  'Falco: At this pick, {player} is a steal.',
  'Falco: The card writes itself here. Pure value.',
  'Falco: That’s a clean win on the board.',
  'Falco: That’s how you stack value in round one.',
  'Falco: {team} just got a gift at {pick}.',
  'Falco: That’s a talent tier above this slot.',
  'Falco: {player} should’ve been gone earlier.',
  'Falco: Perfect timing. Great value.',
  'Falco: That’s a strong value pocket pick.',
];

const reachQuotes = [
  'Falco: That’s early. Traits are big, tape is thin.',
  'Falco: {team} is betting on projection there.',
  'Falco: That’s a reach by my board.',
  'Falco: Someone in the room fell in love with upside.',
  'Falco: That’s a swing at {pick}.',
  'Falco: The value didn’t line up on that one.',
  'Falco: Bold call. I had him later.',
  'Falco: {player} is good, but that’s early.',
  'Falco: I don’t see first-round value at this spot.',
  'Falco: That’s a stretch unless the fit is perfect.',
];

const needQuotes = [
  'Falco: That fits a top need and makes sense.',
  'Falco: Clean fit. {team} needed that piece.',
  'Falco: That’s smart roster math.',
  'Falco: {team} filled a real hole with that pick.',
  'Falco: Need and value aligned there.',
  'Falco: That’s a sensible team-build pick.',
  'Falco: {player} plugs a gap immediately.',
  'Falco: Good fit, good plan.',
  'Falco: That’s a roster win for {team}.',
  'Falco: Not flashy, but it solves a problem.',
];

const safeQuotes = [
  'Falco: Solid pick. High floor, steady returns.',
  'Falco: That’s a safe bet in round one.',
  'Falco: You know what you’re getting.',
  'Falco: Reliable tape, reliable projection.',
  'Falco: Good player, good slot.',
  'Falco: That’s a steady starter profile.',
  'Falco: No drama with that pick.',
  'Falco: {player} is a clean projection.',
  'Falco: That’s a firm, safe selection.',
  'Falco: Not wild, but it works.',
];

const riskQuotes = [
  'Falco: That’s a risk profile pick. Watch the flags.',
  'Falco: Talent is real, but the risk is loud.',
  'Falco: {team} is gambling on the upside.',
  'Falco: That’s a dice roll with a big ceiling.',
  'Falco: Boom or bust. No in-between.',
  'Falco: You’ll need patience with that profile.',
  'Falco: The floor is scary, the ceiling is real.',
  'Falco: That’s a high-variance pick.',
  'Falco: Not for the faint of heart.',
  'Falco: That’s a risk tolerance test.',
];

const gradeQuotes = [
  'Falco: That’s how you win a draft room.',
  'Falco: Love the value and the fit on that one.',
  'Falco: Smart pick, clean process.',
  'Falco: That’s a solid answer to a real need.',
  'Falco: You can build around picks like that.',
  'Falco: That’s a quiet steal.',
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
