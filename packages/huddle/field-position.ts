import type { Game } from './index';
import { FIELD_TOP, FIELD_BOTTOM, FIELD_GOALS, FIELD_WIDTH } from './field-assets';
const clamp = (n: number) => Math.max(0, Math.min(100, n));
/** Coordinate zero is the left goal line; possession plus direction identifies each territory. */
export function gameYardLineToFieldPosition({
  possession,
  opponent,
  yardLineTeam,
  yardLine,
  direction,
}: {
  possession: string;
  opponent: string;
  yardLineTeam: string | null;
  yardLine: number;
  direction: 1 | -1;
}) {
  if (!Number.isFinite(yardLine) || yardLine < 0 || yardLine > 50) throw Error('Invalid yard line');
  if (yardLine === 50) return 50;
  if (yardLineTeam !== possession && yardLineTeam !== opponent) throw Error('Unknown territory');
  const fromOwnGoal = yardLineTeam === possession ? yardLine : 100 - yardLine;
  return direction === 1 ? fromOwnGoal : 100 - fromOwnGoal;
}
// Visual calibration only. Goal edges come from geometry.json. Interior anchors
// follow the painted numbered yard lines in the unchanged 1614×304 base PNG.
// The image is asymmetric (50 is not canvas center) and includes a duplicated
// right-side 30; we preserve the supplied artwork rather than redraw its markings.
export const FIELD_YARD_ANCHORS = [
  [0, FIELD_GOALS.leftTop, FIELD_GOALS.leftBottom],
  [10, 405, 281],
  [20, 491, 396],
  [30, 577, 510],
  [40, 665, 624],
  [50, 751, 738],
  [60, 839, 853],
  [70, 924, 966],
  [80, 1096, 1194],
  [90, 1181, 1312],
  [100, FIELD_GOALS.rightTop, FIELD_GOALS.rightBottom],
] as const;
export function fieldPoint(position: number, y = (FIELD_TOP + FIELD_BOTTOM) / 2) {
  const pos = clamp(position),
    index = Math.min(9, Math.floor(pos / 10));
  const from = FIELD_YARD_ANCHORS[index],
    to = FIELD_YARD_ANCHORS[index + 1];
  const t = (pos - from[0]) / (to[0] - from[0]);
  const top = from[1] + (to[1] - from[1]) * t,
    bottom = from[2] + (to[2] - from[2]) * t;
  const fraction = Math.max(0, Math.min(1, (y - FIELD_TOP) / (FIELD_BOTTOM - FIELD_TOP)));
  return { x: top + (bottom - top) * fraction, y };
}
/** Shared placement for the code-driven UI only; PNG layers always fill the canvas. */
export function fieldUI(position: number, direction: 1 | -1) {
  const point = fieldPoint(position),
    top = fieldPoint(position, FIELD_TOP);
  return {
    point,
    badge: { x: Math.max(100, Math.min(FIELD_WIDTH - 100, top.x)), y: 4, width: 180, height: 42 },
    logo: { x: point.x - direction * 90 - 28, y: point.y - 26, width: 56, height: 52 },
  };
}
export function firstDownPosition(game: Game) {
  if (game.ball === null || /goal|touchdown/i.test(game.down)) return null;
  if (game.firstDownTarget !== undefined) return game.firstDownTarget;
  const distance = game.down.match(/&\s*(\d+)/)?.[1];
  if (!distance) return null;
  const target = game.ball + game.direction * Number(distance);
  return target > 0 && target < 100 ? target : null;
}
