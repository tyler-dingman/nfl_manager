import { resolveBeatPlayer } from './beat-players';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { adaptBeatStory, type BeatStoryInput } from '@/components/beat/beat-story-adapter';
import type { TransactionGraphic, TransactionPlayer } from '@/components/beat/beat-transaction';

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const roster = [...NFL_LEAGUE_DATA.players, ...NFL_LEAGUE_DATA.freeAgents];
/** Exact unique player lookup only; a number on a former team is not a new jersey number. */
export function enrichBeatTransaction(story: BeatStoryInput) {
  const decision = adaptBeatStory({ ...story, player: story.player ?? resolveBeatPlayer(story) });
  if (decision.graphic.family !== 'transaction') return decision;
  const data: TransactionGraphic = { ...decision.graphic };
  const enrich = (player: TransactionPlayer): TransactionPlayer => {
    const matches = roster.filter((p) =>
      player.playerId ? p.id === player.playerId : key(p.name) === key(player.name),
    );
    const unique = [...new Map(matches.map((p) => [p.id, p])).values()];
    if (unique.length !== 1) return player;
    const p = unique[0];
    const team = 'teamAbbr' in p ? p.teamAbbr : p.currentTeamAbbr;
    const jerseyData = p as typeof p & { jerseyNumber?: string; jersey?: string };
    const number = team === data.team ? (jerseyData.jerseyNumber ?? jerseyData.jersey) : undefined;
    decision.evidence.push({
      field: 'playerId',
      value: p.id,
      source: 'canonical',
      excerpt: 'Persisted player roster: ' + p.name,
    });
    return {
      ...player,
      playerId: p.id,
      position: player.position ?? p.position,
      jersey:
        player.jersey ?? (number && /^\d{1,2}$/.test(String(number)) ? String(number) : undefined),
    };
  };
  Object.assign(
    data,
    enrich({
      name: data.name,
      position: data.position,
      jersey: data.jersey,
      playerId: data.playerId,
    }),
  );
  if (data.players) data.players = data.players.map(enrich);
  data.transactionType ??=
    data.action === 'TRADED' || data.action === 'ADDED' ? 'OTHER' : data.action;
  return { ...decision, graphic: data, displayCategory: 'Roster Move' };
}
