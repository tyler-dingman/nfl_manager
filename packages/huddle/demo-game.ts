import type { Game, Message, Play, Snapshot } from './index';
import { gameYardLineToFieldPosition } from './field-position';
import type { PlayVisualization } from './play-visualization';
const players = {
  'DeVonta Smith': {
    id: '4241478',
    name: 'DeVonta Smith',
    position: 'WR',
    team: 'PHI',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4241478.png',
  },
  'DaRon Bland': {
    id: '4248911',
    name: 'DaRon Bland',
    position: 'CB',
    team: 'DAL',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4248911.png',
  },
  'Saquon Barkley': {
    id: '3929630',
    name: 'Saquon Barkley',
    position: 'RB',
    team: 'PHI',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3929630.png',
  },
  'Dallas Goedert': {
    id: '3121023',
    name: 'Dallas Goedert',
    position: 'TE',
    team: 'PHI',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3121023.png',
  },
  'Jalen Hurts': {
    id: '4040715',
    name: 'Jalen Hurts',
    position: 'QB',
    team: 'PHI',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4040715.png',
  },
};
const start = '2026-01-01T00:00:00.000Z';
const rows = [
  ['8:42', '1st & 10', 'PHI', 20, 6, '2nd & 4', 'Barkley rushes for 6 yards.', 'GAIN'],
  [
    '8:06',
    '2nd & 4',
    'PHI',
    26,
    9,
    '1st & 10',
    'Hurts completes a 9-yard pass to DeVonta Smith. First down.',
    'FIRST DOWN',
  ],
  [
    '7:28',
    '1st & 10',
    'PHI',
    35,
    0,
    '2nd & 10',
    'Hurts pass incomplete intended for Dallas Goedert.',
    'INCOMPLETE',
  ],
  [
    '6:51',
    '2nd & 10',
    'PHI',
    35,
    12,
    '1st & 10',
    'Barkley rushes for 12 yards. First down.',
    'FIRST DOWN',
  ],
  [
    '6:18',
    '1st & 10',
    'PHI',
    47,
    20,
    '1st & 10',
    'Hurts completes a 20-yard pass to DeVonta Smith. First down.',
    'FIRST DOWN',
  ],
  ['5:42', '1st & 10', 'DAL', 33, -6, '2nd & 16', 'Hurts sacked for a loss of 6 yards.', 'SACK'],
  [
    '5:06',
    '2nd & 16',
    'DAL',
    39,
    17,
    '1st & 10',
    'Barkley rushes for 17 yards. First down.',
    'FIRST DOWN',
  ],
  [
    '4:31',
    '1st & 10',
    'DAL',
    22,
    10,
    '1st & 10',
    'Hurts intercepted by DaRon Bland at the DAL 12.',
    'INTERCEPTION',
  ],
  [
    '3:54',
    '1st & 10',
    'DAL',
    16,
    7,
    '2nd & 3',
    'New PHI possession: Barkley rushes for 7 yards.',
    'GAIN',
  ],
  [
    '3:16',
    '2nd & 3',
    'DAL',
    9,
    9,
    'TOUCHDOWN',
    'Hurts completes a 9-yard touchdown pass to Dallas Goedert.',
    'TOUCHDOWN',
  ],
] as const;
const comments: Record<number, [string, string]> = {
  4: ['PhillyMike', "That's the connection we needed."],
  8: ['BirdsFilmRoom', 'Need a stop after that turnover.'],
  10: ['GoBirds2024', "LET'S GOOOOO 🔥"],
};
export const DEMO_PLAYS = rows.map(
  ([clock, down, yardLineTeam, yardLine, yards, nextDown, description, resultType], i) => {
    const position = gameYardLineToFieldPosition({
      possession: 'PHI',
      opponent: 'DAL',
      yardLineTeam,
      yardLine,
      direction: 1,
    });
    const resultingPosition = position + yards;
    const distance = Number(nextDown.match(/& (\d+)/)?.[1] ?? 0);
    return {
      id: `demo-play-${i + 1}`,
      sequence: i + 1,
      quarter: 3,
      clock,
      possession: 'PHI',
      down,
      yardLineTeam,
      yardLine,
      normalizedFieldPosition: position,
      resultingPosition,
      nextDown,
      description,
      yards,
      resultType,
      homeScore: 10,
      awayScore: i === 9 ? 17 : 10,
      driveId: 'demo-drive',
      firstDownTarget:
        distance && resultingPosition + distance < 100 ? resultingPosition + distance : null,
      comments: comments[i + 1] ? [comments[i + 1]] : [],
    };
  },
);
const seconds = (clock: string) => {
  const [m, s] = clock.split(':').map(Number);
  return m * 60 + s;
};
export function demoSnapshot(step: number): Snapshot {
  const index = Math.max(0, Math.min(9, step)),
    current = DEMO_PLAYS[index],
    occurred = DEMO_PLAYS.slice(0, index + 1);
  const elapsed = seconds(DEMO_PLAYS[0].clock) - seconds(current.clock);
  const location =
    current.resultingPosition === 100
      ? 'DAL end zone'
      : current.resultingPosition === 50
        ? '50'
        : current.resultingPosition < 50
          ? `PHI ${current.resultingPosition}`
          : `DAL ${100 - current.resultingPosition}`;
  const plays: Play[] = occurred.map((p) => ({
    id: p.id,
    sequence: p.sequence,
    quarter: 3,
    clock: p.clock,
    down: p.down,
    location: `${p.yardLineTeam} ${p.yardLine}`,
    text: p.description,
    yards: p.yards,
    scoring: p.resultType === 'TOUCHDOWN',
    key: p.resultType === 'FIRST DOWN' || p.resultType === 'TOUCHDOWN',
    driveId: p.driveId,
    at: null,
    resultType: p.resultType,
    visualization: {
      type: (
        [
          'run',
          'completion',
          'incomplete',
          'run',
          'completion',
          'sack',
          'run',
          'interception',
          'run',
          'touchdown',
        ] as const
      )[p.sequence - 1],
      startYardLine: p.normalizedFieldPosition,
      endYardLine: p.resultingPosition,
      ...(p.sequence === 3 ? { targetYardLine: 45 } : {}),
      primaryPlayer: players[[1, 4, 7, 9].includes(p.sequence) ? 'Saquon Barkley' : 'Jalen Hurts'],
      secondaryPlayer: [2, 5].includes(p.sequence)
        ? players['DeVonta Smith']
        : [3, 10].includes(p.sequence)
          ? players['Dallas Goedert']
          : p.sequence === 8
            ? players['DaRon Bland']
            : undefined,
      yards: p.yards,
      possessionTeam: 'PHI',
      description: p.description,
    } satisfies PlayVisualization,
  }));
  const messages: Message[] = occurred.flatMap((p) =>
    p.comments.map(([name, body]) => ({
      id: `comment-${p.id}`,
      userId: `fixture-${name}`,
      name: `${name} · sample`,
      avatar: null,
      body,
      at: new Date(Date.parse(start) + p.sequence * 1000).toISOString(),
      playId: p.id,
      likes: 0,
      removed: false,
    })),
  );
  const game: Game = {
    id: 'development-fictional-PHI-DAL',
    home: 'DAL',
    homeRecord: '0-0',
    awayRecord: '0-0',
    away: 'PHI',
    homeScore: current.homeScore,
    awayScore: current.awayScore,
    status: 'live',
    clock: current.clock,
    quarter: 3,
    kickoff: start,
    possession: index === 7 ? 'DAL' : 'PHI',
    down: current.nextDown,
    location,
    ball: current.resultingPosition,
    direction: index === 7 ? -1 : 1,
    firstDownTarget: index === 7 ? current.resultingPosition - 10 : current.firstDownTarget,
    driveId: 'demo-drive',
    driveSummary: `${index + 1} plays · ${current.resultingPosition - 20} yards · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} elapsed · PHI 20 → ${location}`,
    updatedAt: start,
    plays,
  };
  return {
    game,
    messages,
    polls: [],
    participants: 1284,
    cursor: '',
    before: null,
    hiddenUsers: [],
    voted: {},
    liked: [],
    canModerate: false,
  };
}
