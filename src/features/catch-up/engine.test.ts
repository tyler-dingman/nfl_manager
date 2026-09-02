import assert from 'node:assert/strict';
import test from 'node:test';

import { getThreeAndOutPackage } from '@/features/three-and-out/data';

import {
  buildCatchUpItems,
  isCatchUpEligible,
  isNewVisit,
  snapshotStoryStates,
} from './engine';

const baselineAt = '2026-08-30T12:00:00.000Z';
const current = () => snapshotStoryStates(getThreeAndOutPackage('KC').current);
const compare = (baseline = current(), next = current(), now = new Date('2026-08-30T13:00:00Z')) =>
  buildCatchUpItems({ teamId: 'KC', baseline, current: next, baselineAt, now });

test('first visit is hidden and eligibility begins on a later visit', () => {
  assert.equal(isCatchUpEligible(true, 1), false);
  assert.equal(isCatchUpEligible(false, 2), true);
});

test('a refresh inside the inactivity window is not a new visit', () => {
  assert.equal(isNewVisit('2026-08-30T12:00:00Z', new Date('2026-08-30T12:29:59Z')), false);
  assert.equal(isNewVisit('2026-08-30T12:00:00Z', new Date('2026-08-30T12:30:00Z')), true);
});

test('identical story state produces no catch-up items', () => {
  assert.equal(compare().items.length, 0);
});

test('one material summary change produces one CHANGED item', () => {
  const before = current();
  const after = before.map((story, index) =>
    index === 0 ? { ...story, summary: `${story.summary} A starter returned to practice.`, fingerprint: 'material-change' } : story,
  );
  const result = compare(before, after);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].type, 'CHANGED');
});

test('multiple meaningful stories are ranked rather than counted as source articles', () => {
  const before = current();
  const changed = before.slice(0, 3).map((story, index) => ({
    ...story,
    fingerprint: `changed-${index}`,
    importanceScore: 70 + index,
  }));
  const result = compare(before, [...changed, ...before.slice(3)]);
  assert.equal(result.total, 3);
  assert.equal(result.items[0].importanceScore, 72);
});

test('a meaningful new story is NEW and duplicate sources stay on one story item', () => {
  const before = current();
  const story = {
    ...before[0],
    id: 'kc-new-story',
    title: 'A transaction becomes official',
    sourceCount: 5,
    sources: [...before[0].sources, ...before[0].sources],
    fingerprint: 'new-story',
  };
  const result = compare(before, [...before, story]);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].type, 'NEW');
  assert.equal(result.items[0].storyId, 'kc-new-story');
});

test('a story becoming resolved is classified RESOLVED', () => {
  const before = current();
  const after = before.map((story, index) =>
    index === 0 ? { ...story, status: 'RESOLVED' as const, fingerprint: 'resolved' } : story,
  );
  assert.equal(compare(before, after).items[0].type, 'RESOLVED');
});

test('cosmetic title and timestamp changes do not produce catch-up items', () => {
  const before = current();
  const after = before.map((story, index) =>
    index === 0
      ? { ...story, title: `${story.title}!`, lastMaterialUpdateAt: '2026-08-30T12:59:00Z' }
      : story,
  );
  assert.equal(compare(before, after).items.length, 0);
});

test('entering Three and Out is a meaningful ranked change', () => {
  const before = current();
  const target = before[3];
  const after = before.map((story) =>
    story.id === target.id ? { ...story, inThreeAndOut: true, rank: 2 } : story,
  );
  assert.equal(compare(before, after).items.some((item) => item.storyId === target.id), true);
});

test('story clustering retains one canonical state for duplicate story IDs', () => {
  const snapshot = getThreeAndOutPackage('KC').current;
  snapshot.puntStories.push({ ...snapshot.stories[0], importanceScore: 1 });
  const states = snapshotStoryStates(snapshot);
  assert.equal(states.filter((story) => story.id === snapshot.stories[0].id).length, 1);
});

test('team comparisons remain independent and old baselines use current-state mode', () => {
  const kansasCity = current();
  const chicago = snapshotStoryStates(getThreeAndOutPackage('CHI').current);
  assert.equal(compare(kansasCity, chicago).items.every((item) => item.teamId === 'KC'), true);
  const result = buildCatchUpItems({
    teamId: 'KC',
    baseline: kansasCity,
    current: chicago,
    baselineAt: '2026-08-01T00:00:00Z',
    now: new Date('2026-08-30T13:00:00Z'),
  });
  assert.equal(result.mode, 'CURRENT_STATE');
});
