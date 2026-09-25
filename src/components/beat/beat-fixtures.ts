import type { BeatGraphicData } from './beat-model';

// Development-only composition samples, never imported by a feed or ingestion adapter.
export const beatFixtures: Array<{ id: string; category: string; graphic: BeatGraphicData }> = [
  {
    id: 'semantic-interview',
    category: 'Interview',
    graphic: { family: 'interview', name: 'Jeff Hafley', transcript: true },
  },
  { id: 'semantic-analysis', category: 'Analysis', graphic: { family: 'analysis' } },
  {
    id: 'stadium-event',
    category: 'Events',
    graphic: { family: 'off_field', subtype: 'EVENT', label: 'STADIUM\nEVENTS' },
  },
  { id: 'feature', category: 'Standard / Feature', graphic: { family: 'standard' } },
  {
    id: 'matchup',
    category: 'Game / Matchup',
    graphic: {
      family: 'game-matchup',
      leftTeam: 'KC',
      rightTeam: 'IND',
      week: 'WEEK 3',
      kickoff: 'SUN · 1:00 PM ET',
    },
  },
  {
    id: 'result',
    category: 'Game Result',
    graphic: {
      family: 'game-result',
      leftTeam: 'KC',
      rightTeam: 'IND',
      leftScore: 33,
      rightScore: 30,
      final: 'FINAL · OT',
    },
  },
  {
    id: 'numbered',
    category: 'Numbered / List',
    graphic: { family: 'numbered', count: '5', descriptor: 'THINGS\nTO WATCH' },
  },
  {
    id: 'stats',
    category: 'Stats / Data',
    graphic: {
      family: 'stats',
      count: '3',
      descriptor: 'KEY\nSTATS',
      rows: [
        { value: '0', label: 'TURNOVERS' },
        { value: '18.4%', label: 'PRESSURE RATE' },
        { value: '6', label: 'STRAIGHT PD GAMES' },
      ],
    },
  },
  {
    id: 'player',
    category: 'Player Focus',
    graphic: { family: 'player', name: 'KAHLIL\nBENSON', position: 'LT', jersey: '72' },
  },
  {
    id: 'injury',
    category: 'Injury Report',
    graphic: {
      family: 'injury',
      period: 'W3',
      rows: [
        { count: 2, status: 'OUT' },
        { count: 1, status: 'QUESTIONABLE' },
        { count: 1, status: 'DOUBTFUL' },
      ],
    },
  },
  {
    id: 'transaction',
    category: 'Roster / Transaction',
    graphic: {
      family: 'transaction',
      team: 'KC',
      action: 'SIGNED',
      name: 'TYLER GOODSON',
      position: 'RB',
      jersey: '32',
      contract: { term: '1 YEAR', value: '$1.78M' },
    },
  },
  {
    id: 'quote',
    category: 'Quote / Interview',
    graphic: {
      family: 'quote',
      quote: 'WE’RE AT OUR BEST\nWHEN EVERYBODY\nGETS INVOLVED.',
      attribution: 'SAMPLE SPEAKER · QB',
    },
  },
  { id: 'film', category: 'Strategy / Film', graphic: { family: 'film' } },
  {
    id: 'developing',
    category: 'Developing Story',
    graphic: {
      family: 'developing',
      updates: [
        { time: '8:42 AM', detail: 'Misses walkthrough' },
        { time: '11:18 AM', detail: 'Not seen during open practice' },
        { time: '1:36 PM', detail: 'Listed as DNP' },
      ],
    },
  },
  {
    id: 'business',
    category: 'Business / Community',
    graphic: { family: 'business-community', label: 'COMMUNITY\nCONNECTIONS' },
  },
  {
    id: 'scouting',
    category: 'Scouting / Opponent',
    graphic: { family: 'scouting', opponent: 'CIN' },
  },
  { id: 'coaching', category: 'Coaching / Strategy', graphic: { family: 'coaching' } },
  { id: 'league', category: 'Around the NFL', graphic: { family: 'league' } },
  {
    id: 'video',
    category: 'Video / Media',
    graphic: {
      family: 'video',
      title: 'PRESS\nCONFERENCE',
      mediaUrl: 'https://example.com/fixture-video',
    },
  },
  ...(['standard-a', 'standard-b', 'standard-c', 'standard-d'] as const).map((family) => ({
    id: family,
    category: 'News',
    graphic: { family },
  })),
  {
    id: 'two-digit',
    category: 'Numbered / List',
    graphic: { family: 'numbered', count: '10', descriptor: 'THINGS\nTO KNOW' },
  },
  {
    id: 'three-by-three',
    category: 'Numbered / List',
    graphic: { family: 'numbered', count: '3×3', descriptor: 'MATCHUPS\nTO WATCH' },
  },
  {
    id: 'long-name',
    category: 'Player Focus',
    graphic: { family: 'player', name: 'CHRISTIAN\nGONZALEZ', position: 'OLB', jersey: '99' },
  },
  {
    id: 'long-action',
    category: 'Roster / Transaction',
    graphic: {
      family: 'transaction',
      team: 'GB',
      action: 'ELEVATED',
      name: 'MARQUEZ VALDES-SCANTLING',
      position: 'WR',
    },
  },
  {
    id: 'released',
    category: 'Roster / Transaction',
    graphic: {
      family: 'transaction',
      team: 'BUF',
      action: 'RELEASED',
      name: 'SAMPLE PLAYER',
      position: 'WR',
    },
  },
  {
    id: 'missing-logo',
    category: 'Game / Matchup',
    graphic: {
      family: 'game-matchup',
      leftTeam: 'KC',
      rightTeam: 'UNK',
      week: 'WEEK 12',
      kickoff: 'SUN · 4:25 PM ET',
    },
  },
  {
    id: 'missing-data',
    category: 'Injury',
    graphic: {
      family: 'injury',
      period: '',
      rows: [] as unknown as [
        { count: number; status: string },
        { count: number; status: string },
        { count: number; status: string },
      ],
    },
  },

  {
    id: 'ten-things-said',
    category: 'Numbered / List',
    graphic: { family: 'numbered', count: '10', descriptor: 'THINGS\nSAID' },
  },
  {
    id: 'three-takeaways',
    category: 'Numbered / List',
    graphic: { family: 'numbered', count: '3', descriptor: 'TAKEAWAYS' },
  },
  { id: 'raiders-recap', category: 'Game Recap', graphic: { family: 'recap', teams: ['LV'] } },
  {
    id: 'raiders-matchup',
    category: 'Game Matchup',
    graphic: { family: 'game-matchup', leftTeam: 'LV', rightTeam: 'LAC', week: 'W2' },
  },
  {
    id: 'inactive-report',
    category: 'Inactive Report',
    graphic: { family: 'injury', period: 'W2', detail: 'INACTIVE\nREPORT', rows: [] },
  },
  {
    id: 'player-update',
    category: 'Player Update',
    graphic: {
      family: 'player',
      name: 'DJ Moore',
      position: 'WR',
      status: 'QUESTIONABLE TO RETURN',
      context: 'IN-GAME UPDATE',
    },
  },
  { id: 'depth-chart', category: 'Depth Chart', graphic: { family: 'depth-chart' } },
  { id: 'mailbag', category: 'Mailbag', graphic: { family: 'mailbag' } },
  { id: 'practice', category: 'Practice', graphic: { family: 'practice' } },
  {
    id: 'two-updates',
    category: 'Developing',
    graphic: {
      family: 'developing',
      updates: [
        { time: '8:42 AM', detail: 'Misses walkthrough' },
        { time: '11:18 AM', detail: 'Not seen at practice' },
      ],
    },
  },
];
