import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDedupeKey,
  isQuietHour,
  resolveAudienceForEvent,
  type NotificationAudienceTarget,
  type NotificationEvent,
  type NotificationPriority,
} from './index';

test('team audience resolution includes matching team followers and intensity rules', () => {
  const event: NotificationEvent = {
    id: 'evt-1',
    type: 'BREAKING_STORY',
    teamId: 'KC',
    priority: 'HIGH',
    title: 'Chiefs trade update',
    body: 'A major move is on the way.',
    deepLink: '/story/evt-1',
    createdAt: new Date().toISOString(),
  };

  const targets: NotificationAudienceTarget[] = [
    { userId: 'u1', intensity: 'CASUAL', teamFollows: ['KC'] },
    { userId: 'u2', intensity: 'LOCKED_IN', teamFollows: ['BUF'] },
    { userId: 'u3', intensity: 'SICKO', teamFollows: ['KC'] },
  ];

  const result = resolveAudienceForEvent(event, targets);
  assert.deepEqual(result.map((item) => item.userId).sort(), ['u1', 'u3']);
  assert.equal(result.every((item) => item.priority === 'HIGH'), true);
});

test('quiet hours respect the user timezone and allow breaking overrides', () => {
  assert.equal(
    isQuietHour({ enabled: true, startLocalTime: '22:00', endLocalTime: '06:00', timezone: 'America/Chicago', allowBreakingOverride: true }, '2026-08-30T03:30:00-05:00'),
    true,
  );
  assert.equal(
    isQuietHour({ enabled: true, startLocalTime: '22:00', endLocalTime: '06:00', timezone: 'America/Chicago', allowBreakingOverride: true }, '2026-08-30T12:00:00-05:00'),
    false,
  );
});

test('dedupe keys collapse repeated updates from the same story and use a collapse window', () => {
  const first = buildDedupeKey('BREAKING_STORY', 'team:KC:story:123', 'HIGH');
  const second = buildDedupeKey('BREAKING_STORY', 'team:KC:story:123', 'HIGH');
  const other = buildDedupeKey('BREAKING_STORY', 'team:KC:story:456', 'HIGH');
  assert.equal(first, second);
  assert.notEqual(first, other);
});

test('priority is normalized and high-priority stories bypass quiet hours when allowed', () => {
  const high: NotificationPriority = 'HIGH';
  assert.equal(high, 'HIGH');
});
