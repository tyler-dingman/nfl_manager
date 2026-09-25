import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { beatTeam } from '@/components/beat/beat-model';
import type { BeatStoryInput } from '@/components/beat/beat-story-adapter';
const roster = [
  ...new Map(
    [...NFL_LEAGUE_DATA.players, ...NFL_LEAGUE_DATA.freeAgents].map((p) => [p.id, p]),
  ).values(),
];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A unique full roster name in the title establishes the player subject, not a summary mention. */
export function resolveBeatPlayer(story: BeatStoryInput): BeatStoryInput['player'] {
  const matches = roster.filter((p) =>
    new RegExp('\\b' + escape(p.name) + "(?=\\b|[’'])", 'i').test(story.headline),
  );
  if (matches.length !== 1) return undefined;
  const p = matches[0];
  const teamId = 'teamAbbr' in p ? p.teamAbbr : p.currentTeamAbbr;
  const sameTeam = !!teamId && beatTeam(teamId) === beatTeam(story.teamAbbr);
  const data = p as typeof p & { jerseyNumber?: string | number; jersey?: string | number };
  const number = data.jerseyNumber ?? data.jersey;
  // Explicit article position may refine a generic roster OT into LT/RT.
  const detail = [story.headline, story.summary, story.whatHappened ?? ''].join('\n');
  const role = detail.match(
    new RegExp(escape(p.name) + '[^.\\n]{0,70}?\\b(left tackle|right tackle)\\b', 'i'),
  );
  return {
    playerId: p.id,
    name: p.name,
    teamId: teamId ?? undefined,
    position: role ? (/left/i.test(role[1]) ? 'LT' : 'RT') : p.position,
    jersey:
      sameTeam && number !== undefined && /^\d{1,2}$/.test(String(number))
        ? String(number)
        : undefined,
  };
}
