import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';

const LOW_INTEREST_QUOTES = [
  "I think I'm going to test free agency",
  "I'm not sure {TEAM} is the right place for me",
  'You better back up the Brinks truck',
] as const;

const MEDIUM_INTEREST_QUOTES = [
  "I'm interested in coming back",
  'I enjoyed my time with {TEAM}',
  'If {TEAMMATE_FIRST_NAME} comes back, I will too',
  'I would like a better contract than last time',
] as const;

const HIGH_INTEREST_QUOTES = [
  'I would love to run it back',
  "I don't care about the money at this point",
  "Let's win a championship",
  "I don't want to move again, sign me back",
] as const;

const getTeamDisplayName = (teamAbbr?: string | null) => {
  if (!teamAbbr) return null;
  const team = NFL_LEAGUE_DATA.teams.find((entry) => entry.abbr === teamAbbr.toUpperCase());
  if (!team) return null;
  return team.name.replace(/^((New|Los|Las|San|Tampa)\s+\w+\s+)/i, '').trim() || team.name;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const pickDeterministic = <T>(items: readonly T[], seed: string): T | null => {
  if (items.length === 0) return null;
  return items[hashString(seed) % items.length] ?? null;
};

const getInterestBucket = (interestPct?: number | null): 'low' | 'medium' | 'high' | null => {
  if (typeof interestPct !== 'number' || !Number.isFinite(interestPct)) {
    return null;
  }
  if (interestPct >= 65) return 'high';
  if (interestPct >= 40) return 'medium';
  return 'low';
};

export const buildInterestQuote = ({
  playerId,
  interestPct,
  teamAbbr,
  teammateFirstNames,
}: {
  playerId: string;
  interestPct?: number | null;
  teamAbbr?: string | null;
  teammateFirstNames?: string[];
}): string | undefined => {
  const bucket = getInterestBucket(interestPct);
  if (!bucket) return undefined;

  const teamName = getTeamDisplayName(teamAbbr);
  const teammateName = pickDeterministic(
    (teammateFirstNames ?? []).filter(Boolean),
    `${playerId}:teammate`,
  );

  const templates = (
    bucket === 'high'
      ? HIGH_INTEREST_QUOTES
      : bucket === 'medium'
        ? MEDIUM_INTEREST_QUOTES
        : LOW_INTEREST_QUOTES
  ).filter((quote) => {
    if (quote.includes('{TEAMMATE_FIRST_NAME}') && !teammateName) return false;
    if (quote.includes('{TEAM}') && !teamName) return false;
    return true;
  });

  const template = pickDeterministic(templates, `${playerId}:${bucket}`);
  if (!template) return undefined;

  return template
    .replaceAll('{TEAM}', teamName ?? 'this team')
    .replaceAll('{TEAMMATE_FIRST_NAME}', teammateName ?? 'my teammate');
};
