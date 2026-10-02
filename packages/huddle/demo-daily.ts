// Development-only reference content. Never imported into the production data path.
import type { Snapshot, Message } from './index';
import { dailyRoomId } from './daily';
export function dailySnapshot(team: string, name: string): Snapshot {
  const kc = team === 'KC',
    date = '2026-09-30',
    id = dailyRoomId(team, date);
  const nick = name.split(' ').at(-1) ?? team;
  const rows = [
    [
      'ChiefsMike',
      'If Tyreek is serious about wanting to play with Reid again, you make that call. This offense with him would be electric.',
      42,
      2,
    ],
    [
      'RedFriday',
      'Raiders week feels different this year. Defense is going to set the tone.',
      28,
      6,
    ],
    ['D&D', 'Andy Reid says Josh Simmons is dealing with a bulging disk in his lower back. How concerned are you about left tackle heading into Raiders week? Discuss below 👇', 0, 10],
    [
      'Arrowhead4Life',
      'Love seeing Mahomes back out there. Now let’s get the O-line right for Sunday.',
      18,
      12,
    ],
    ['ChiefsChick', 'The Raiders always bring out the worst in me. Need a statement game.', 16, 18],
    ['Huddle Poll', '', 52, 25],
    ['KCNative', 'This defense is trending in the right direction. Spags is cooking.', 14, 28],
    ['MidwestChief', 'Can we just get through this week healthy? That’s the biggest win.', 11, 35],
  ] as const;
  const messages: Message[] = rows.map(([author, body, likes, minutes], i) => ({
    id: `${id}:entry:${i}`,
    userId: `fixture-fan-${i}`,
    name: kc ? author : i === 2 ? 'D&D' : i === 5 ? 'Huddle Poll' : `${nick}Fan${i + 1}`,
    avatar: null,
    body: kc
      ? body
      : i === 2
        ? `Welcome to today’s ${nick} conversation. Share what you’re watching this week.`
        : i === 5
          ? ''
          : [
              'What should be our biggest priority this week?',
              'Defense can set the tone. What do you think?',
              '',
              'Looking forward to seeing this team back on the field.',
              'Let’s make a statement this week.',
              '',
              'I like the direction this team is heading.',
              'Staying healthy is the biggest win.',
            ][i],
    likes,
    at: new Date(Date.parse('2026-09-30T16:44:00Z') - minutes * 60000).toISOString(),
    playId: null,
    removed: false,
    kind: i === 2 ? 'update' : i === 5 ? 'poll' : 'comment',
    pollId: i === 5 ? `${id}:poll:1` : undefined,
  }));
  return {
    game: null,
    messages,
    polls: [
      {
        id: `${id}:poll:1`,
        question: kc
          ? 'Would you want Tyreek Hill back in KC?'
          : `Feeling confident about the ${nick} this week?`,
        options: ['Yes', 'No'],
        counts: [848, 399],
        closed: false,
      },
      {
        id: `${id}:poll:2`,
        question: 'Which side of the ball sets the tone this week?',
        options: ['Offense', 'Defense'],
        counts: [190, 260],
        closed: false,
      },
      {
        id: `${id}:poll:3`,
        question: 'What matters most this week?',
        options: ['Staying healthy', 'Building momentum'],
        counts: [214, 180],
        closed: false,
      },
    ],
    participants: 284,
    cursor: '',
    before: null,
    hiddenUsers: [],
    voted: {},
    liked: [],
    canModerate: false,
    daily: {
      id,
      team,
      date,
      status: 'ACTIVE',
      summary: kc
        ? "Simmons’ injury. OBJ to KC? Raiders week."
        : `${nick} football. This week. Your voice.`,
      description: `Whatever’s on your mind about the ${nick} today, this is the place.`,
      featuredPollId: `${id}:poll:1`,
      pulseLabel: kc ? 'Would welcome Tyreek back' : `Confident in the ${nick}`,
      metrics: { hereNow: 284, comments: 1200, fans: 847, polls: 3 },
      fixture: true,
      previous: [
        kc
          ? 'Tyreek, Raiders week, and Mahomes is back'
          : 'This week’s priorities and the road ahead',
        'Defensive growth, trade rumors, and Week 3 takeaways',
        kc ? 'Week 2 win, Worthy breakout, and what’s next' : 'Week 2 takeaways and what’s next',
        'Offensive struggles, defensive fixes, and a crucial Week 2',
        'Season opener, new look, and early takeaways',
      ].map((summary, i) => ({
        id: dailyRoomId(team, `2026-09-${29 - i}`),
        date: `2026-09-${29 - i}`,
        summary,
        comments: [842, 612, 1100, 934, 1300][i],
      })),
    },
  };
}
