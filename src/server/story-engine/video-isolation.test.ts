import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('YouTube candidates are stored for Film Room but never queued for Beat synthesis', () => {
  const service = readFileSync('src/server/story-engine/service.ts', 'utf8');
  assert.match(service, /action: 'film-room-only'/);
  assert.match(service, /Keep the candidate available to Film Room/);
  assert.match(service, /if \(!videoOnly\)/);
  assert.match(service, /source\.sourceType === 'YOUTUBE'/);
});

test('public story projections require at least one non-video source', () => {
  const projections = readFileSync('src/server/story-engine/projections.ts', 'utf8');
  const guards = projections.match(/beat_source\.source_type<>'YOUTUBE'/g) ?? [];
  assert.ok(guards.length >= 3, 'list, paginated list, and detail projections must all be guarded');
  assert.match(projections, /metadata->>'platform'/);
});

test('Film Room continues reading YouTube candidates directly', () => {
  const filmRoom = readFileSync('src/server/film-room/discovered.ts', 'utf8');
  assert.match(filmRoom, /FROM content_candidates candidate/);
  assert.match(filmRoom, /platform' = 'YOUTUBE'/);
});
