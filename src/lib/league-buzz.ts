import { getTeamFlavorHandle, getTeamReactionLine } from '@/lib/team-flavor';

type LeagueBuzzEventType = 'capClearingCut' | 'renegotiate' | 'resign';

export type LeagueBuzzToastPayload = {
  displayName: string;
  subtitle: string;
  message: string;
  likes: string;
  reposts: string;
  comments: string;
};

const MESSAGE_TEMPLATES: Record<LeagueBuzzEventType, string[]> = {
  capClearingCut: [
    'The {teamName} just cleared {capAmount} in cap space by releasing {playerName}. Prime to make a move? 💰',
    '{teamName} opens major cap room with a veteran release. Watch this space. 👀',
  ],
  renegotiate: [
    'The {teamName} restructure {playerName}’s deal to create flexibility. Smart front office move. 📊',
    '{teamName} frees up room with a creative contract move. Aggressive and calculated. 🔧',
  ],
  resign: [
    'The {teamName} lock in {playerName} long-term. Core piece stays home. 🔒',
    '{teamName} bring back a key piece before he hits the market. Huge retention win. 🏆',
  ],
};

const EVENT_ODDS: Record<LeagueBuzzEventType, number> = {
  capClearingCut: 0.78,
  renegotiate: 0.64,
  resign: 0.72,
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
    displayName: 'National Football League',
    subtitle:
      getTeamFlavorHandle(teamAbbr) !== 'Franchise Football'
        ? `League Buzz · ${getTeamFlavorHandle(teamAbbr)}`
        : 'League Buzz',
    message: `${message} ${flavoredTail}`.trim(),
    likes: formatCompact(likesBase),
    reposts: formatCompact(repostsBase),
    comments: formatCompact(commentsBase),
  };
};
