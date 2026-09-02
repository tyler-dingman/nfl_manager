import type { EditorialVisualData } from '../../../packages/editorial-visual';

export type HuddleGalleryFixture = {
  id: string;
  family: EditorialVisualData['visualType'];
  headline: string;
  summary: string;
  sourceCount: number;
  materialUpdateCount?: number;
  visual: EditorialVisualData;
};

const visual = (
  visualType: EditorialVisualData['visualType'],
  input: Omit<EditorialVisualData, 'visualType' | 'teamId'>,
): EditorialVisualData => ({ visualType, teamId: 'KC', ...input });

export const HUDDLE_CARD_GALLERY_FIXTURES: HuddleGalleryFixture[] = [
  {
    id: 'dev-player-mahomes',
    family: 'PLAYER',
    headline: 'Mahomes turns another broken play into an explosive gain',
    summary:
      'Development fixture showing a player-led visual with supplied performance statistics.',
    sourceCount: 4,
    visual: visual('PLAYER', {
      eyebrow: 'PLAYER SPOTLIGHT · TEST DATA',
      primaryText: 'PATRICK MAHOMES',
      secondaryText: 'QB · #15',
      number: '15',
      stats: [
        { label: 'COMP', value: '24' },
        { label: 'YDS', value: '312' },
        { label: 'TD', value: '3' },
      ],
    }),
  },
  {
    id: 'dev-injury-rice',
    family: 'INJURY_AVAILABILITY',
    headline: "Rice's availability is the key practice story today",
    summary:
      'Development fixture demonstrating status and practice participation supplied as structured data.',
    sourceCount: 5,
    materialUpdateCount: 2,
    visual: visual('INJURY_AVAILABILITY', {
      eyebrow: 'INJURY / AVAILABILITY · TEST DATA',
      primaryText: 'RASHEE RICE',
      secondaryText: 'WR · #4',
      number: '4',
      status: 'QUESTIONABLE',
      items: [
        { label: 'WED', detail: 'DNP' },
        { label: 'THU', detail: 'LIMITED' },
        { label: 'FRI', detail: 'FULL' },
      ],
    }),
  },
  {
    id: 'dev-depth-chart',
    family: 'DEPTH_CHART',
    headline: 'The competition for complementary receiver snaps remains open',
    summary:
      'Development fixture using ordinal labels rather than fabricated snap-share percentages.',
    sourceCount: 3,
    visual: visual('DEPTH_CHART', {
      eyebrow: 'DEPTH CHART · TEST DATA',
      primaryText: 'Wide receiver rotation',
      secondaryText: 'WR ROTATION',
      items: [
        { label: 'MARQUISE BROWN', detail: 'STARTER' },
        { label: 'XAVIER WORTHY', detail: 'ROTATION' },
        { label: 'SKYY MOORE', detail: 'CHALLENGER' },
      ],
    }),
  },
  {
    id: 'dev-transaction-pounds',
    family: 'TRANSACTION',
    headline: 'Chiefs acquire tackle Diego Pounds in fixture transaction',
    summary:
      'Development-only transaction example. The player, route, and action are intentionally marked as test data.',
    sourceCount: 2,
    visual: visual('TRANSACTION', {
      eyebrow: 'ROSTER MOVE · TEST DATA',
      primaryText: 'DIEGO POUNDS',
      secondaryText: 'OT · BAL → KC',
      action: 'TRADED',
    }),
  },
  {
    id: 'dev-developing',
    family: 'DEVELOPING',
    headline: 'Chiefs continue monitoring an evolving practice story',
    summary:
      'Development fixture showing three verified-style material updates without creating duplicate cards.',
    sourceCount: 6,
    materialUpdateCount: 3,
    visual: visual('DEVELOPING', {
      eyebrow: 'DEVELOPING STORY · TEST DATA',
      primaryText: 'CHIEFS MONITOR PRACTICE STATUS',
      status: 'WATCHING',
      timeline: [
        { time: '8:42 AM', label: 'Player misses walkthrough' },
        { time: '11:18 AM', label: 'Limited during open practice' },
        { time: '1:36 PM', label: 'Team lists status as limited' },
      ],
    }),
  },
  {
    id: 'dev-data',
    family: 'DATA',
    headline: 'Chiefs offense creates explosive plays at a fixture rate',
    summary: 'Development fixture demonstrating a dominant supplied value and comparison labels.',
    sourceCount: 4,
    visual: visual('DATA', {
      eyebrow: 'DATA / TREND · TEST DATA',
      primaryText: 'Explosive play rate',
      value: '14.8%',
      label: 'EXPLOSIVE PLAY RATE',
      stats: [
        { label: 'FIXTURE NFL AVG', value: '10.2%' },
        { label: 'FIXTURE RANK', value: '3RD' },
      ],
    }),
  },
  {
    id: 'dev-playbook',
    family: 'PLAYBOOK',
    headline: 'How a layered crossing concept can stress zone coverage',
    summary:
      'Illustrative D&D diagram for development review—not a representation of the Chiefs’ proprietary playbook.',
    sourceCount: 3,
    visual: visual('PLAYBOOK', {
      eyebrow: 'FILM ROOM · TEST DATA',
      primaryText: 'LAYERED CROSSING CONCEPT',
    }),
  },
  {
    id: 'dev-game-preview',
    family: 'GAME_PREVIEW',
    headline: 'Chiefs vs. Bills fixture preview: three matchups to watch',
    summary: 'Development-only opponent, kickoff, and venue data for visual review.',
    sourceCount: 5,
    visual: visual('GAME_PREVIEW', {
      eyebrow: 'GAME PREVIEW · TEST DATA',
      primaryText: 'THREE FIXTURE MATCHUPS TO WATCH',
      opponentTeamId: 'BUF',
      kickoff: 'SUN · 3:25 PM CT · TEST DATA',
      venue: 'ARROWHEAD · TEST DATA',
    }),
  },
  {
    id: 'dev-game-result',
    family: 'GAME_RESULT',
    headline: 'Chiefs close out a fixture win over Buffalo',
    summary: 'Development-only score and opponent data for reviewing the result treatment.',
    sourceCount: 6,
    visual: visual('GAME_RESULT', {
      eyebrow: 'GAME RESULT · TEST DATA',
      primaryText: 'FIXTURE FINAL',
      opponentTeamId: 'BUF',
      value: '27–24',
      kickoff: 'FINAL · TEST DATA',
      venue: 'ARROWHEAD · TEST DATA',
    }),
  },
  {
    id: 'dev-generic',
    family: 'GENERIC_NEWS',
    headline: 'The Chiefs story D&D is following today',
    summary:
      'This fixture intentionally contains no specialized structured metadata so the fallback can be reviewed.',
    sourceCount: 3,
    visual: visual('GENERIC_NEWS', {
      eyebrow: 'THE HUDDLE · TEST DATA',
      primaryText: 'THE STORY D&D IS FOLLOWING TODAY',
      secondaryText: 'TEAM NEWS',
    }),
  },
];
