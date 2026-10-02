import {
  deriveSavedPlayStatus,
  type SavedPlay,
  type SavedPlayStatus,
  type SavedLegStatus,
} from '../../src/components/parlay-lab/saved-plays';
export type GradeResult = {
  id: string;
  status: SavedPlayStatus;
  gradedAt?: string;
  event?: SavedPlay['event'];
  legs: Array<{
    id: string;
    status: SavedLegStatus;
    actualResult?: number | null;
    gradedAt?: string;
  }>;
};
export function applySavedPlayResults(source: SavedPlay[], results: GradeResult[]): SavedPlay[] {
  const byPlay = new Map(results.map((result) => [result.id, result]));
  return source.map((play) => {
    const result = byPlay.get(play.id);
    if (!result) return play;
    const used = new Set<number>();
    const selections = play.selections.map((leg) => {
      const index = result.legs.findIndex(
        (item, candidate) => item.id === leg.id && !used.has(candidate),
      );
      if (index < 0) return leg;
      used.add(index);
      return { ...leg, ...result.legs[index], gradingStatus: result.legs[index].status };
    });
    return {
      ...play,
      event: result.event ?? play.event,
      selections,
      status: deriveSavedPlayStatus(selections.map((leg) => leg.gradingStatus ?? 'UPCOMING')),
      gradedAt: result.gradedAt ?? play.gradedAt,
    };
  });
}
