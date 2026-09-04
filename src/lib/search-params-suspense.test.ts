import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('shared AppShell owns a local Suspense boundary for its search params', () => {
  const source = readFileSync('src/components/app-shell.tsx', 'utf8');
  assert.match(
    source,
    /function AppShell[\s\S]*?<Suspense fallback={null}>[\s\S]*?<AppShellContent>/,
  );
  assert.match(source, /function AppShellContent[\s\S]*?useSearchParams\(\)/);
});

test('direct route search-param consumers have local boundaries', () => {
  for (const file of [
    'src/app/roster/page.tsx',
    'src/app/manage/trades/page.tsx',
    'src/app/draft/room/page.tsx',
    'src/app/game-day/page.tsx',
  ]) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /Suspense/, file);
  }
});

test('root layout does not mask search-param errors globally', () => {
  const source = readFileSync('src/app/layout.tsx', 'utf8');
  assert.doesNotMatch(source, /<Suspense[\s\S]*?<AppProviders>/);
});
