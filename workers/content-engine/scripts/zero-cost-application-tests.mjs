import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const directories = [
  'src/server/auth',
  'src/server/user',
  'src/server/search',
  'src/server/three-and-out',
  'src/server/notifications',
  'src/features/story-engine',
  'src/server/content',
  'src/server/film-room',
  'src/server/odds',
  'src/server/front-office',
  'src/server/content-automation',
  'src/features/three-and-out',
  'src/features/home',
  'packages/parlay',
];
const files = directories.flatMap((directory) =>
  readdirSync(new URL(`${directory}/`, new URL('../../../', import.meta.url)))
    .filter((file) => file.endsWith('.test.ts'))
    .map((file) => `${directory}/${file}`),
);
files.push(
  'src/app/api/automation/three-and-out/route.test.ts',
  'src/features/content/content-detail-page.test.ts',
  'src/features/content/pagination.test.ts',
);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files.sort()], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: '', PRODUCTION_DATABASE_URL: '' },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
