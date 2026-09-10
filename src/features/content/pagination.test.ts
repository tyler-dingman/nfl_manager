import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { DEFAULT_BEAT_PAGE_SIZE, parseBeatPage, visiblePageNumbers } from './pagination';

test('The Beat uses one 20-item page-size constant and parses invalid pages safely', () => {
  assert.equal(DEFAULT_BEAT_PAGE_SIZE, 20);
  for (const value of [null, '', 'abc', '0', '-5', '1.5']) assert.equal(parseBeatPage(value), 1);
  assert.equal(parseBeatPage('4'), 4);
});

test('offset pages have 20 items, stable order, correct totals, and no overlap', () => {
  const records = Array.from({ length: 47 }, (_, index) => ({
    id: String(47 - index).padStart(3, '0'),
    publishedAt:
      index < 2
        ? '2026-09-09T12:00:00Z'
        : `2026-09-${String(8 - Math.floor(index / 6)).padStart(2, '0')}T12:00:00Z`,
  })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
  const first = records.slice(0, DEFAULT_BEAT_PAGE_SIZE);
  const second = records.slice(DEFAULT_BEAT_PAGE_SIZE, DEFAULT_BEAT_PAGE_SIZE * 2);
  assert.equal(first.length, 20);
  assert.equal(second.length, 20);
  assert.equal(new Set([...first, ...second].map((item) => item.id)).size, 40);
  assert.equal(Math.ceil(records.length / DEFAULT_BEAT_PAGE_SIZE), 3);
  assert.deepEqual(
    records,
    [...records].sort(
      (a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id),
    ),
  );
});

test('desktop page numbers use ellipses rather than dozens of controls', () => {
  assert.deepEqual(visiblePageNumbers(9, 18), [1, 8, 9, 10, 18]);
  assert.deepEqual(visiblePageNumbers(1, 3), [1, 2, 3]);
});

test('API and UI preserve URL state, reset changed filters, and expose accessible controls', () => {
  const api = readFileSync('src/app/api/content/huddle/route.ts', 'utf8');
  const projection = readFileSync('src/server/story-engine/projections.ts', 'utf8');
  const ui = readFileSync('src/components/team-content-hub.tsx', 'utf8');
  assert.match(api, /DEFAULT_BEAT_PAGE_SIZE/);
  assert.match(projection, /LIMIT \$\{pageSize\} OFFSET \$\{offset\}/);
  assert.match(projection, /last_meaningful_update_at.*DESC,s\.id DESC/s);
  assert.match(ui, /params\.set\('page', '1'\)/);
  assert.match(ui, /aria-label="The Beat pagination"/);
  assert.match(ui, /aria-current=/);
  assert.match(ui, /sm:hidden/);
  assert.match(ui, /prefers-reduced-motion/);
  assert.match(ui, /searchParams.*page/s);
});
