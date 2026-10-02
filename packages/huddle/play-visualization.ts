import type { Game } from './index';
import { fieldPoint } from './field-position';
export type FieldPlayer = {
  id: string;
  name: string;
  position: string;
  team: string;
  headshotUrl?: string | null;
};
export type PlayVisualization = {
  type:
    | 'run'
    | 'completion'
    | 'incomplete'
    | 'sack'
    | 'interception'
    | 'fumble'
    | 'touchdown'
    | 'field_goal'
    | 'punt'
    | 'other';
  startYardLine: number;
  endYardLine: number;
  targetYardLine?: number;
  primaryPlayer?: FieldPlayer;
  secondaryPlayer?: FieldPlayer;
  yards: number | null;
  possessionTeam: string;
  scoringTeam?: string;
  description: string;
};
export function latestVisualization(game: Game) {
  const play = [...game.plays].sort((a, b) => b.sequence - a.sequence)[0];
  return play?.visualization ? { ...play.visualization, description: play.text } : null;
}
export function playGeometry(play: PlayVisualization, progress = 1) {
  const pass =
    ['completion', 'incomplete', 'interception'].includes(play.type) ||
    (play.type === 'touchdown' && !!play.secondaryPlayer);
  const end =
    play.type === 'incomplete' ? (play.targetYardLine ?? play.startYardLine) : play.endYardLine;
  const start = fieldPoint(play.startYardLine);
  const destination = fieldPoint(end, play.type === 'touchdown' ? 70 : undefined);
  if (play.type === 'touchdown') {
    destination.x += end >= 100 ? 35 : -35;
  }
  const moving = fieldPoint(play.startYardLine + (end - play.startYardLine) * progress);
  const markers = [];
  if (play.primaryPlayer)
    markers.push({
      player: play.primaryPlayer,
      point: pass ? start : progress === 1 ? destination : moving,
      reveal: 0,
    });
  if (
    pass &&
    play.secondaryPlayer &&
    (play.type !== 'incomplete' || play.targetYardLine !== undefined)
  )
    markers.push({ player: play.secondaryPlayer, point: destination, reveal: 0.65 });
  if (play.type === 'fumble' && play.secondaryPlayer)
    markers.push({
      player: play.secondaryPlayer,
      point: { x: destination.x + 42, y: destination.y - 20 },
      reveal: 0.65,
    });
  const sign = destination.x >= start.x ? 1 : -1;
  const finish = { x: destination.x - sign * 40, y: destination.y };
  const arc = Math.min(68, 22 + Math.abs(end - play.startYardLine) * 1.1);
  const path =
    Math.abs(destination.x - start.x) > 30
      ? pass
        ? `M${start.x} ${start.y} Q${(start.x + finish.x) / 2} ${Math.min(start.y, finish.y) - arc} ${finish.x} ${finish.y}`
        : `M${start.x} ${start.y} L${finish.x} ${finish.y}`
      : '';
  return {
    markers,
    path,
    destination,
    indicator:
      play.type === 'touchdown'
        ? 'TD'
        : play.type === 'interception'
          ? 'INT'
          : play.type === 'fumble'
            ? 'FUM'
            : play.type === 'incomplete'
              ? '×'
              : play.type === 'field_goal'
                ? 'FG'
                : '',
  };
}
