import type { EditorialVisualData } from '../../../packages/editorial-visual';

const base = (visualType: EditorialVisualData['visualType']): EditorialVisualData => ({
  visualType,
  teamId: 'CIN',
  eyebrow: visualType.replaceAll('_', ' '),
  primaryText: 'A realistic development built for visual review',
});

export const EDITORIAL_VISUAL_FIXTURES: EditorialVisualData[] = [
  {
    ...base('PLAYER'),
    eyebrow: 'PLAYER SPOTLIGHT',
    primaryText: "JA'MARR CHASE",
    secondaryText: 'WR · #1',
    number: '1',
    stats: [
      { label: 'REC', value: '8' },
      { label: 'YDS', value: '126' },
      { label: 'TD', value: '1' },
    ],
  },
  {
    ...base('INJURY_AVAILABILITY'),
    eyebrow: 'INJURY / AVAILABILITY',
    primaryText: 'TEE HIGGINS',
    secondaryText: 'WR · #5',
    number: '5',
    status: 'QUESTIONABLE',
    items: [{ label: 'WED', detail: 'DNP' }, { label: 'THU', detail: 'DNP' }, { label: 'FRI' }],
  },
  {
    ...base('DEPTH_CHART'),
    eyebrow: 'DEPTH CHART BATTLE',
    primaryText: 'Wide receiver competition',
    secondaryText: 'WR2',
    items: [
      { label: 'ANDREI IOSIVAS', detail: 'STARTER' },
      { label: 'JERMAINE BURTON', detail: 'CHALLENGER' },
    ],
  },
  {
    ...base('TRANSACTION'),
    eyebrow: 'ROSTER MOVE',
    primaryText: 'Bengals add veteran depth at running back',
    secondaryText: 'RB · #32',
    action: 'SIGNED',
    number: '32',
  },
  {
    ...base('DEVELOPING'),
    eyebrow: 'DEVELOPING STORY',
    primaryText: "Bengals keep an eye on Higgins' status",
    status: 'WATCHING',
    timeline: [
      { time: '8:42 AM', label: 'Misses walkthrough' },
      { time: '11:18 AM', label: 'Not seen during open practice' },
      { time: '1:36 PM', label: 'Listed as DNP' },
    ],
  },
  {
    ...base('DATA'),
    eyebrow: 'DATA / PLAYBOOK',
    primaryText: 'Pressure rate without blitz',
    value: '38%',
    label: 'PRESSURE RATE WITHOUT BLITZ',
    stats: [
      { label: 'NFL AVG', value: '31%' },
      { label: 'NFL RANK', value: '6TH' },
    ],
  },
  {
    ...base('PLAYBOOK'),
    eyebrow: 'FILM ROOM',
    primaryText: 'Why this play-action look creates stress',
  },
  {
    ...base('GAME_PREVIEW'),
    eyebrow: 'GAME PREVIEW',
    primaryText: 'Five matchups that could decide the opener',
    opponentTeamId: 'JAX',
  },
  {
    ...base('GAME_RESULT'),
    eyebrow: 'GAME RESULT',
    primaryText: 'Three takeaways from the final',
    opponentTeamId: 'JAX',
    value: '27–20',
  },
  {
    ...base('GENERIC_NEWS'),
    eyebrow: 'THE HUDDLE',
    primaryText: 'The story D&D is following today',
    secondaryText: 'TEAM NEWS',
  },
];
