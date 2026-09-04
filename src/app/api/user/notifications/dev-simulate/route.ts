import { NextRequest, NextResponse } from 'next/server';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { createNotification, type NotificationCategory } from '@/server/notifications/repository';

const fixtures: Array<{
  type: NotificationCategory;
  title: string;
  body: string;
  href: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
}> = [
  {
    type: 'HOT_READ',
    title: 'Chiefs acquire OT Diego Pounds in trade',
    body: '2 independent sources confirm the move.',
    href: '/the-beat?team=KC',
    priority: 'HIGH',
  },
  {
    type: 'INJURY',
    title: 'Josh Simmons ruled out Sunday',
    body: 'The Chiefs updated his game status.',
    href: '/the-beat?team=KC',
    priority: 'HIGH',
  },
  {
    type: 'GAME_DAY',
    title: 'It’s Game Day.',
    body: 'KC kicks off at noon.',
    href: '/game-day?team=KC',
    priority: 'NORMAL',
  },
  {
    type: 'TRIVIA',
    title: 'Mike passed you.',
    body: 'He moved 14 yards ahead in Current Drive.',
    href: '/trivia',
    priority: 'NORMAL',
  },
  {
    type: 'FRONT_OFFICE',
    title: 'Your offseason is ready to continue.',
    body: 'Pick up where you left off.',
    href: '/offseason',
    priority: 'LOW',
  },
  {
    type: 'CATCH_UP',
    title: '5 updates since you were here.',
    body: 'Catch up on the latest Chiefs developments.',
    href: '/catch-up?team=KC',
    priority: 'NORMAL',
  },
];

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return authError('Not found.', 404);
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const batch = `dev:${Date.now()}`;
    const created = await Promise.all(
      fixtures.map((fixture, index) =>
        createNotification(user.id, {
          eventId: `${batch}:${index}`,
          dedupeKey: `${batch}:${index}`,
          teamAbbr: ['TRIVIA', 'FRONT_OFFICE'].includes(fixture.type) ? null : 'KC',
          type: fixture.type,
          category: fixture.type,
          title: fixture.title,
          body: fixture.body,
          deepLink: fixture.href,
          priority: fixture.priority,
          pushEligible: fixture.priority === 'HIGH',
          metadata: { simulated: true },
        }),
      ),
    );
    return NextResponse.json({ ok: true, created: created.filter(Boolean).length });
  } catch {
    return authError('Unable to create test notifications.');
  }
}
