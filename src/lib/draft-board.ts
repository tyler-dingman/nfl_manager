import { resolvePlayerRating } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';

const normalizeDraftPosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (['LT', 'RT', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'C', 'IOL', 'G'].includes(normalized)) return 'IOL';
  if (['EDGE', 'ED', 'DE', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['DT', 'NT', 'DL', 'IDL'].includes(normalized)) return 'DL';
  if (['OLB', 'MLB', 'ILB', 'LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  return normalized;
};

const getNeedBoost = (player: PlayerRowDTO, teamNeeds: string[]) => {
  const normalizedPosition = normalizeDraftPosition(player.position);
  const needIndex = teamNeeds.findIndex(
    (need) => normalizeDraftPosition(need) === normalizedPosition,
  );
  if (needIndex === -1) return 0;
  return [18, 12, 7][needIndex] ?? 4;
};

const getValueDelta = (player: PlayerRowDTO, currentPickOverall: number) => {
  const expectedPick = player.projectedPick ?? player.rank ?? currentPickOverall;
  return currentPickOverall - expectedPick;
};

const getSleeperBoost = (player: PlayerRowDTO) => {
  const rating = resolvePlayerRating(player) ?? 68;
  const rank = player.rank ?? player.projectedPick ?? 80;
  if (rating >= 80 && rank >= 18) return 8;
  if (rating >= 77 && rank >= 28) return 5;
  return 0;
};

export type DraftBoardTag = 'Best Available' | 'Team Need' | 'Steal' | 'Sleeper';

export type DraftBoardEntry = {
  player: PlayerRowDTO;
  boardScore: number;
  fitScore: number;
  valueDelta: number;
  tags: DraftBoardTag[];
};

export const rankDraftBoard = ({
  prospects,
  teamNeeds,
  currentPickOverall,
  limit = 12,
}: {
  prospects: PlayerRowDTO[];
  teamNeeds: string[];
  currentPickOverall: number;
  limit?: number;
}): DraftBoardEntry[] => {
  const ranked = prospects
    .filter((player) => !player.isDrafted)
    .map((player) => {
      const rating = resolvePlayerRating(player) ?? 68;
      const boardRank = player.rank ?? player.projectedPick ?? 250;
      const needBoost = getNeedBoost(player, teamNeeds);
      const valueDelta = getValueDelta(player, currentPickOverall);
      const sleeperBoost = getSleeperBoost(player);
      const boardScore =
        rating * 0.7 +
        Math.max(0, 140 - boardRank) * 0.45 +
        needBoost +
        Math.max(0, valueDelta) * 1.3 +
        sleeperBoost;

      return {
        player,
        boardScore: Number(boardScore.toFixed(2)),
        fitScore: needBoost,
        valueDelta,
        sleeperBoost,
      };
    })
    .sort((left, right) => {
      if (right.boardScore !== left.boardScore) return right.boardScore - left.boardScore;
      return (left.player.rank ?? 999) - (right.player.rank ?? 999);
    });

  return ranked.slice(0, limit).map((entry, index) => {
    const tags: DraftBoardTag[] = [];
    if (index === 0) {
      tags.push('Best Available');
    }
    if (entry.fitScore >= 7) {
      tags.push('Team Need');
    }
    if (entry.valueDelta >= 8) {
      tags.push('Steal');
    } else if (entry.sleeperBoost >= 5) {
      tags.push('Sleeper');
    }

    return {
      player: entry.player,
      boardScore: entry.boardScore,
      fitScore: entry.fitScore,
      valueDelta: entry.valueDelta,
      tags: tags.slice(0, 2),
    };
  });
};

export const getDraftAutopick = ({
  prospects,
  teamNeeds,
  currentPickOverall,
}: {
  prospects: PlayerRowDTO[];
  teamNeeds: string[];
  currentPickOverall: number;
}) => rankDraftBoard({ prospects, teamNeeds, currentPickOverall, limit: 1 })[0]?.player ?? null;
