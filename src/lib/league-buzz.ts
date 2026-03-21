import { getTeamFlavorHandle, getTeamReactionLine } from '@/lib/team-flavor';

type LeagueBuzzEventType = 'capClearingCut' | 'renegotiate' | 'resign' | 'freeAgency';

export type LeagueBuzzToastPayload = {
  displayName: string;
  subtitle: string;
  message: string;
  avatarUrl?: string | null;
  likes: string;
  reposts: string;
  comments: string;
};

const ROUND_TRANSITION_MESSAGES = [
  'Round {roundNumber} is in the books. We move to Round {nextRound}.',
  'Round {roundNumber} complete. Day 2 keeps rolling.',
  'Round {roundNumber} is over. Now the board starts to get interesting.',
  '{playerLastName} is still on the board. Does he go early in Round {nextRound}?',
  'A few surprise slides so far. Round {nextRound} should get wild.',
  'We’re heading into Round {nextRound}. Teams are hunting value now.',
  'Round {roundNumber} done. Let’s see who finds the steal next.',
  '{playerLastName} keeps falling. Feels like Round {nextRound} could be his spot.',
  'Needs start driving the board now. Round {nextRound} is up next.',
  'That round flew by. On to Round {nextRound}.',
  'Some big names still available. Round {nextRound} could get chaotic.',
  'Round {roundNumber} closed. Expect movement early in Round {nextRound}.',
  'The board’s thinning out. Now the value picks matter.',
  'Round {roundNumber} is complete. Let’s see who reaches and who steals one in Round {nextRound}.',
] as const;

const JIM_SCHWARTZ_AVATAR_URL = '/images/jim_schwartz.png';

const MESSAGE_TEMPLATES: Record<LeagueBuzzEventType, string[]> = {
  capClearingCut: [
    '{teamName} made a hard decision by cutting {playerName}, but it saves {capAmount} in much needed cap space.',
    '{teamName} move on from {playerName} to create {capAmount} in much needed cap space. Tough business.',
  ],
  renegotiate: [
    'The {teamName} restructure {playerName}’s deal to create flexibility. Smart front office move. 📊',
    '{teamName} frees up room with a creative contract move. Aggressive and calculated. 🔧',
  ],
  resign: [
    'The {teamName} lock in {playerName} long-term. Core piece stays home. 🔒',
    '{teamName} bring back a key piece before he hits the market. Huge retention win. 🏆',
  ],
  freeAgency: [
    '{teamName} land {playerName} in free agency. That is a real addition for this roster. ✍️',
    '{teamName} make a notable free-agent move by signing {playerName}. Smart roster boost. 📈',
  ],
};

const EVENT_ODDS: Record<LeagueBuzzEventType, number> = {
  capClearingCut: 1,
  renegotiate: 0.64,
  resign: 0.72,
  freeAgency: 0.78,
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const formatCompact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : `${value}`;

const pickTemplate = (eventType: LeagueBuzzEventType, seed: string) => {
  const options = MESSAGE_TEMPLATES[eventType];
  return options[hashString(seed) % options.length] ?? options[0];
};

export const generateLeagueBuzzToast = ({
  eventType,
  teamName,
  playerName,
  capSavings,
  teamAbbr,
}: {
  eventType: LeagueBuzzEventType;
  teamName: string;
  playerName: string;
  capSavings?: number | null;
  teamAbbr?: string | null;
}): LeagueBuzzToastPayload | null => {
  const seed = `${eventType}:${teamAbbr ?? ''}:${teamName}:${playerName}:${capSavings ?? 0}`;
  const odds = EVENT_ODDS[eventType];
  if ((hashString(`${seed}:gate`) % 1000) / 1000 > odds) {
    return null;
  }

  const template = pickTemplate(eventType, seed);
  const capAmount = typeof capSavings === 'number' ? `$${capSavings.toFixed(1)}M` : '$0.0M';
  const message = template
    .replace('{teamName}', teamName)
    .replace('{playerName}', playerName)
    .replace('{capAmount}', capAmount);
  const flavoredTail =
    eventType === 'capClearingCut'
      ? getTeamReactionLine(teamAbbr, 'suspenseful', { seed: `${seed}:tone` })
      : getTeamReactionLine(teamAbbr, 'positive', { seed: `${seed}:tone` });
  const likesBase = 1800 + (hashString(`${seed}:likes`) % 6200);
  const repostsBase = 220 + (hashString(`${seed}:reposts`) % 1600);
  const commentsBase = 90 + (hashString(`${seed}:comments`) % 900);

  return {
    displayName: 'Jim Schwartz',
    subtitle:
      getTeamFlavorHandle(teamAbbr) !== 'Franchise Football'
        ? `League Buzz · ${getTeamFlavorHandle(teamAbbr)}`
        : 'League Buzz',
    message: `${message} ${flavoredTail}`.trim(),
    avatarUrl: JIM_SCHWARTZ_AVATAR_URL,
    likes: formatCompact(likesBase),
    reposts: formatCompact(repostsBase),
    comments: formatCompact(commentsBase),
  };
};

export const generateRoundTransitionBuzzToast = ({
  roundNumber,
  nextRound,
  fallingPlayerLastName,
  teamAbbr,
}: {
  roundNumber: number;
  nextRound: number;
  fallingPlayerLastName?: string | null;
  teamAbbr?: string | null;
}): LeagueBuzzToastPayload => {
  const seededMessages = ROUND_TRANSITION_MESSAGES.filter(
    (message) => fallingPlayerLastName || !message.includes('{playerLastName}'),
  );
  const seed = `round-transition:${teamAbbr ?? ''}:${roundNumber}:${nextRound}:${fallingPlayerLastName ?? ''}`;
  const template = seededMessages[hashString(seed) % seededMessages.length] ?? seededMessages[0];
  const likesBase = 1400 + (hashString(`${seed}:likes`) % 4200);
  const repostsBase = 180 + (hashString(`${seed}:reposts`) % 1200);
  const commentsBase = 70 + (hashString(`${seed}:comments`) % 700);

  return {
    displayName: 'Jim Schwartz',
    subtitle:
      getTeamFlavorHandle(teamAbbr) !== 'Franchise Football'
        ? `League Buzz · ${getTeamFlavorHandle(teamAbbr)}`
        : 'League Buzz',
    message: template
      .replaceAll('{roundNumber}', String(roundNumber))
      .replaceAll('{nextRound}', String(nextRound))
      .replaceAll('{playerLastName}', fallingPlayerLastName ?? 'A prospect'),
    avatarUrl: JIM_SCHWARTZ_AVATAR_URL,
    likes: formatCompact(likesBase),
    reposts: formatCompact(repostsBase),
    comments: formatCompact(commentsBase),
  };
};
