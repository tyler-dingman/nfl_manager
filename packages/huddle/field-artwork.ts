import { FIELD_WIDTH, FIELD_HEIGHT, FIELD_TOP, FIELD_BOTTOM } from './field-assets';
import { fieldPoint, firstDownPosition } from './field-position';
import type { Game } from './index';
/** Dynamic game UI only. No turf, end zones, yard lines, numbers or static artwork. */
export function fieldArtwork(
  game: Game,
  accent: string,
  ball = game.ball ?? 50,
  target = firstDownPosition(game),
  showMarker = true,
) {
  const point = fieldPoint(ball);
  function line(position: number, color: string, kind: string) {
    const a = fieldPoint(position, FIELD_TOP),
      b = fieldPoint(position, FIELD_BOTTOM);
    return `<path data-field-line="${kind}" d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="${color}" stroke-width="5"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FIELD_WIDTH}" height="${FIELD_HEIGHT}" viewBox="0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}">
    ${line(ball, accent, 'scrimmage')}${target === null ? '' : line(target, '#ffd351', 'first-down')}
    ${
      showMarker
        ? `<g transform="translate(${point.x} ${point.y}) scale(${game.direction} 1)">
      <circle r="16" fill="#061b24" stroke="${accent}" stroke-width="4"/>
      <circle r="9" fill="${accent}"/>
      <path d="M23 -9L33 0L23 9" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`
        : ''
    }
  </svg>`;
}
