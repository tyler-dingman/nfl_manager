import { writeFileSync } from 'node:fs';
import { LOGO_PATHS } from '../src/lib/branding/team-logo-paths';
// Split only at closed subpaths. Preserve all official curve commands verbatim;
// convert each initial relative move to absolute so pieces animate independently.
function split(d: string) {
  const tokens = d.match(/[a-z]|-?(?:\d*\.)?\d+/gi)!;
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    i = 0,
    part = '',
    points: number[][] = [];
  const pieces: { d: string; x: number; y: number; width: number; height: number }[] = [];
  const sizes: Record<string, number> = { m: 2, l: 2, c: 6, q: 4, h: 1, v: 1 };
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'z') {
      part += 'z';
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      const minX = Math.min(...xs),
        minY = Math.min(...ys);
      pieces.push({
        d: part,
        x: minX,
        y: minY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
      });
      x = sx;
      y = sy;
      part = '';
      points = [];
      continue;
    }
    if (!(command in sizes)) throw Error(`Unexpected command ${command}`);
    let first = true;
    while (i < tokens.length && !/^[a-z]$/i.test(tokens[i])) {
      const raw = tokens.slice(i, i + sizes[command]);
      const a = raw.map(Number);
      i += a.length;
      if (command === 'm') {
        x += a[0];
        y += a[1];
        sx = x;
        sy = y;
        part += `M${x} ${y}`;
        points.push([x, y]);
      } else {
        part += (first ? command : ' ') + raw.join(' ');
        if (command === 'h') x += a[0];
        else if (command === 'v') y += a[0];
        else {
          for (let j = 0; j < a.length; j += 2) points.push([x + a[j], y + a[j + 1]]);
          x += a[a.length - 2];
          y += a[a.length - 1];
        }
        points.push([x, y]);
      }
      first = false;
    }
  }
  return pieces;
}
const parts = LOGO_PATHS.map((p) => split(p.d));
const letters = parts[3].sort((a, b) => (a.y > 350 ? 1 : 0) - (b.y > 350 ? 1 : 0) || a.x - b.x);
const ticks = parts[2].filter((p) => p.y > 600).sort((a, b) => a.x - b.x);
const data = {
  letters,
  ticks,
  badge: parts[2].filter((p) => p.y < 600),
  counters: parts[4].filter((p) => p.x < 1100),
  ampersand: parts[4].filter((p) => p.x >= 1100),
  ampersandCounter: parts[5],
};
writeFileSync(
  'apps/mobile/lib/launch/logo-pieces.ts',
  '// Generated from official LOGO_PATHS by scripts/generate-launch-logo.ts. Do not hand-edit geometry.\nexport const LAUNCH_LOGO = ' +
    JSON.stringify(data, null, 2) +
    ' as const;\n',
);
console.log(
  letters.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.width), Math.round(p.height)]),
);
console.log('ticks', ticks.length);
