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

const FREE_AGENCY_WAVE_SIGNED_MESSAGES = {
  1: [
    '{teamName} is loading up. They signed {player1} right out of the gate.',
    '{teamName} wasted no time. {player1}{andPlayer2Text} are in.',
    '{teamName} came out aggressive in free agency. {player1} headlines the early haul.',
    '{teamName} made noise early. {player1}{andPlayer2Text} gives them immediate help.',
    '{teamName} attacked the market fast. Keep an eye on this group after adding {player1}.',
  ],
  2: [
    '{teamName} came away with some smart value at positions of need.',
    '{teamName} stayed patient and found value in Wave 2.',
    '{teamName} didn’t force it early, but they found useful help in the second wave.',
    '{teamName} may not have chased headlines, but they improved in Wave 2.',
    '{teamName} found some nice value as the market settled.',
    '{teamName} found value with {player1}{andPlayer2Text} as the market cooled.',
    '{teamName} addressed needs without overspending in Wave 2.',
  ],
} as const;

const FREE_AGENCY_WAVE_QUIET_MESSAGES = {
  1: [
    '{teamName} stayed quiet during the opening wave. Let’s see if patience pays off.',
    '{teamName} passed on the early frenzy. Wave 2 could be where they strike.',
    '{teamName} sat out the first push. Plenty of needs still to solve.',
  ],
  2: [
    '{teamName} is still looking for answers as the market thins out.',
    '{teamName} heads into the final wave with work still to do.',
    '{teamName} didn’t make a splash yet. Final wave will be important.',
  ],
} as const;

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

export const generateFreeAgencyWaveTransitionToast = ({
  teamName,
  fromWave,
  nextWave,
  signedPlayers,
  teamAbbr,
}: {
  teamName: string;
  fromWave: 1 | 2;
  nextWave: 2 | 3;
  signedPlayers: Array<{
    firstName: string;
    lastName: string;
    rating?: number | null;
    marketValue?: number | null;
  }>;
  teamAbbr?: string | null;
}): LeagueBuzzToastPayload | null => {
  const player1 = signedPlayers[0];
  const player2 = signedPlayers[1];
  const signedTemplatePool =
    fromWave === 1 ? FREE_AGENCY_WAVE_SIGNED_MESSAGES[1] : FREE_AGENCY_WAVE_SIGNED_MESSAGES[2];
  const quietTemplatePool =
    fromWave === 1 ? FREE_AGENCY_WAVE_QUIET_MESSAGES[1] : FREE_AGENCY_WAVE_QUIET_MESSAGES[2];
  const seed = `free-agency-wave:${teamAbbr ?? ''}:${teamName}:${fromWave}:${nextWave}:${player1?.lastName ?? ''}:${player2?.lastName ?? ''}`;
  const templatePool = signedPlayers.length > 0 ? signedTemplatePool : quietTemplatePool;
  const template = templatePool[hashString(seed) % templatePool.length] ?? templatePool[0];
  const andPlayer2Text = player2 ? ` and ${player2.firstName} ${player2.lastName}` : '';
  const likesBase = 1600 + (hashString(`${seed}:likes`) % 4600);
  const repostsBase = 220 + (hashString(`${seed}:reposts`) % 1500);
  const commentsBase = 90 + (hashString(`${seed}:comments`) % 950);

  return {
    displayName: 'Jim Schwartz',
    subtitle:
      getTeamFlavorHandle(teamAbbr) !== 'Franchise Football'
        ? `League Buzz · ${getTeamFlavorHandle(teamAbbr)}`
        : 'League Buzz',
    message: template
      .replaceAll('{teamName}', teamName)
      .replaceAll(
        '{player1}',
        player1 ? `${player1.firstName} ${player1.lastName}` : 'the right pieces',
      )
      .replaceAll('{andPlayer2Text}', andPlayer2Text),
    avatarUrl: JIM_SCHWARTZ_AVATAR_URL,
    likes: formatCompact(likesBase),
    reposts: formatCompact(repostsBase),
    comments: formatCompact(commentsBase),
  };
};
