// Archived reference fixtures are development-only, alongside the active daily fixtures.
import { dailySnapshot } from './demo-daily';
import { dailyRoomId } from './daily';
import type { Message } from './index';
export function archiveSnapshot(team: string, name: string, date: string) {
  const snapshot = dailySnapshot(team, name),
    daily = snapshot.daily!;
  const previous = daily.previous.find((p) => p.date === date);
  if (!previous)
    return {
      ...snapshot,
      daily: undefined,
      messages: [],
      polls: [],
      participants: null,
      unavailable: 'This archived Huddle is not available in the preview.',
    };
  const featured = team === 'KC' && date === '2026-09-27',
    id = dailyRoomId(team, date),
    nick = name.split(' ').at(-1) ?? team;
  snapshot.daily = {
    ...daily,
    id,
    date,
    status: 'ARCHIVED',
    summary: previous.summary,
    description: featured
      ? 'A big Week 2 win, Worthy’s breakout performance, and what Chiefs Kingdom is watching moving forward.'
      : `Revisit what ${nick} fans had to say: ${previous.summary.toLowerCase()}.`,
    metrics: { hereNow: 0, comments: previous.comments, fans: 724, polls: 5 },
    featuredPollId: `${id}:pulse`,
    topPollId: `${id}:top`,
    finalRecord: featured ? '2–0' : undefined,
    pulseLabel: featured
      ? 'Believe Worthy will be a top 2 receiver this season'
      : `Confident in the ${nick} moving forward`,
  };
  snapshot.polls = [
    {
      id: `${id}:pulse`,
      question: featured
        ? 'Will Worthy be a top 2 receiver this season?'
        : `Are you confident in the ${nick} moving forward?`,
      options: ['Yes', 'No'],
      counts: [1686, 655],
      closed: true,
    },
    {
      id: `${id}:top`,
      question: featured
        ? 'What’s been the biggest key to the 2–0 start?'
        : 'What has been the biggest key for this team?',
      options: featured
        ? ['Mahomes', 'Improved defense', 'Worthy’s breakout']
        : ['Quarterback play', 'Improved defense', 'Young talent'],
      counts: [499, 399, 349],
      closed: true,
    },
  ];
  const rows = [
    [
      'D&D',
      featured
        ? 'Chiefs are 2–0 after a 26–17 win. Mahomes threw for 316 yards and 2 TDs.'
        : `Today’s conversation: ${previous.summary}.`,
      324,
      'update',
    ],
    [
      'ChiefsMike',
      featured
        ? 'Worthy looks like the real deal. That speed changes everything for this offense.'
        : 'There is a lot to build on. What stood out to you?',
      186,
      'comment',
    ],
    [
      'RedFriday',
      'Defense showed up when it mattered. Still things to clean up, but huge win.',
      142,
      'comment',
    ],
    ['Huddle Poll', '', 0, 'poll'],
    [
      'Arrowhead4Life',
      featured
        ? 'Worthy already looks like a game-changer. This offense is about to be scary.'
        : 'The young players are showing real promise. Excited to see what comes next.',
      98,
      'comment',
    ],
    [
      'ChiefsChick',
      featured
        ? 'Love the energy from this team. 2–0 feels different this year.'
        : 'Love the energy from this team. Looking forward to what comes next.',
      76,
      'comment',
    ],
  ] as const;
  snapshot.messages = rows.map(
    ([author, body, likes, kind], i): Message => ({
      id: `${id}:entry:${i}`,
      userId: `fixture-archive-${i}`,
      name: team === 'KC' || kind !== 'comment' ? author : `${nick}Fan${i}`,
      avatar: null,
      body,
      likes,
      kind,
      pollId: kind === 'poll' ? `${id}:top` : undefined,
      at: new Date(Date.parse(`${date}T16:08:00Z`) + i * 23 * 60000).toISOString(),
      playId: null,
      removed: false,
    }),
  );
  snapshot.participants = null;
  return snapshot;
}
