import type { CatchMeUpData, RealtimeStory } from './types';

export const REALTIME_DEMO_STORY: RealtimeStory = {
  id: 'demo-kc-trade-darius-vale',
  teamId: 'KC',
  headline: 'Chiefs reportedly acquire CB Darius Vale in low-cost trade',
  slug: 'chiefs-acquire-darius-vale-demo',
  status: 'CONFIRMED',
  createdAt: '2026-08-30T14:03:20.000Z',
  updatedAt: '2026-08-30T14:17:00.000Z',
  lastCheckedAt: '2026-08-30T14:18:00.000Z',
  eventOccurredAt: '2026-08-30T14:03:20.000Z',
  summary: 'Kansas City is adding a young corner without spending premium draft capital.',
  whatHappened:
    'Kansas City acquired cornerback Darius Vale for a conditional 2028 sixth-round selection. The deal has been confirmed by two trusted reporters and the selling team.',
  whyItMatters:
    'The Chiefs add inexpensive secondary depth and another player who can compete on special teams without sacrificing an early-round pick.',
  whatsNext:
    'Vale must pass a physical. His contract and roster designation are expected before the initial 53-player roster is finalized.',
  sources: [
    {
      id: 'demo-official',
      name: 'Selling team',
      role: 'Official confirmation',
      url: 'https://www.nfl.com/transactions/',
      publishedAt: '2026-08-30T14:05:00.000Z',
      trustTier: 1,
    },
    {
      id: 'demo-reporter-one',
      name: 'Trusted NFL reporter',
      role: 'First report',
      url: 'https://www.nfl.com/news/',
      publishedAt: '2026-08-30T14:03:20.000Z',
      trustTier: 2,
    },
    {
      id: 'demo-reporter-two',
      name: 'Kansas City beat reporter',
      role: 'Compensation details',
      url: 'https://www.chiefs.com/news/',
      publishedAt: '2026-08-30T14:04:10.000Z',
      trustTier: 2,
    },
  ],
  trustLevel: 'Confirmed by an official source and two trusted reporters',
  audio: [
    {
      type: 'quick',
      label: 'Just tell me',
      durationSeconds: 28,
      generatedAt: '2026-08-30T14:04:00.000Z',
      script:
        'Kansas City made a low-cost move for cornerback Darius Vale. The Chiefs are giving up a conditional sixth-round pick, so the risk is limited. Vale now gets a chance to compete for a depth and special-teams role.',
    },
    {
      type: 'coach',
      label: 'Coach, break it down',
      durationSeconds: 58,
      generatedAt: '2026-08-30T14:04:30.000Z',
      script:
        'Alright, here is the move. Kansas City sent a conditional sixth-round pick for Darius Vale, a young corner who can also help on special teams. That is a small acquisition price, so the Chiefs are not betting the roster on him. They are creating competition behind the starters. The next step is the physical, then we see whether he earns one of those last defensive-back spots.',
    },
    {
      type: 'knowBall',
      label: 'I know ball',
      durationSeconds: 124,
      generatedAt: '2026-08-30T14:06:00.000Z',
      script:
        'Kansas City is buying flexibility more than a guaranteed starter. Vale has outside-corner size, but his clearest early path is special teams and matchup depth. Because the pick is conditional, the final cost may depend on whether he stays on the roster. That structure protects the Chiefs if he does not win a role while giving the staff another developmental option.',
    },
  ],
  fanPulse: {
    status: 'EARLY_PULSE',
    overallMood: 'Cautiously optimistic',
    positivePercent: 72,
    neutralPercent: 19,
    negativePercent: 9,
    sampleSize: 486,
    confidence: 'MEDIUM',
    topPositiveThemes: ['Low acquisition cost', 'More secondary competition'],
    topConcerns: ['Limited starting experience'],
    biggestDebate: 'Useful depth piece or a player with real starting upside?',
    trendingTake: 'Fans see the conditional pick as protection against downside.',
    sourceBreakdown: [
      { platform: 'Reddit', positivePercent: 68, sampleSize: 218 },
      { platform: 'YouTube', positivePercent: 76, sampleSize: 146 },
      { platform: 'X', positivePercent: 74, sampleSize: 122 },
    ],
    lastAnalyzedAt: '2026-08-30T14:16:30.000Z',
  },
  videos: [
    {
      id: 'video-1',
      category: 'QUICK TAKES',
      title: 'Immediate reaction: why the price matters',
      creator: 'KC Football Desk',
      duration: '2:14',
      url: 'https://www.youtube.com/',
      usefulnessScore: 94,
    },
    {
      id: 'video-2',
      category: 'DEEPER BREAKDOWNS',
      title: 'Vale’s coverage profile and special-teams path',
      creator: 'Film Room KC',
      duration: '12:43',
      url: 'https://www.youtube.com/',
      usefulnessScore: 91,
    },
    {
      id: 'video-3',
      category: 'PLAYER FILM',
      title: 'Every target from Vale’s final preseason game',
      creator: 'All-22 Review',
      duration: '8:06',
      url: 'https://www.youtube.com/',
      usefulnessScore: 86,
    },
  ],
  videoConsensus:
    'Across the most useful breakdowns, analysts like the low acquisition price and special-teams value. The shared concern is limited starting experience.',
  timeline: [
    {
      id: 'time-1',
      time: '9:03 AM',
      label: 'Trade first reported by a trusted NFL reporter',
      status: 'REPORTED',
    },
    {
      id: 'time-2',
      time: '9:04 AM',
      label: 'Kansas City beat reporter adds compensation',
      status: 'DEVELOPING',
    },
    {
      id: 'time-3',
      time: '9:05 AM',
      label: 'Selling team confirms the transaction',
      status: 'CONFIRMED',
    },
    {
      id: 'time-4',
      time: '9:10 AM',
      label: 'Early public reaction reaches minimum sample',
      status: 'CONFIRMED',
    },
  ],
  verdict: {
    label: 'Chiefs fans: like the value',
    positivePercent: 81,
    consensus:
      'Fans believe Kansas City addressed a useful need without giving up meaningful draft capital.',
    optimists: 'Vale can become an immediate special-teams contributor with developmental upside.',
    skeptics: 'The move may only rearrange the bottom of the depth chart.',
    smartestPoint:
      'The conditional acquisition price limits the downside if Vale does not make the roster.',
    bottomLine: 'A low-risk move with a plausible path to helping this season.',
  },
  tags: ['trade', 'cornerback', 'roster'],
  players: ['Darius Vale'],
  storyType: 'TRADE',
  importance: 94,
  isBreaking: true,
  demo: true,
};

export const REALTIME_DEMO_CATCH_UP: CatchMeUpData = {
  teamId: 'KC',
  since: '8:14 AM',
  storyCount: 3,
  durationSeconds: 107,
  storyIds: [REALTIME_DEMO_STORY.id, 'demo-injury-update', 'demo-workout'],
  script:
    'Alright, three meaningful things happened with Kansas City since you last checked. First, the Chiefs made a low-cost trade for cornerback Darius Vale. Second, the team issued an encouraging injury update at tackle. Third, Kansas City worked out two veteran defensive linemen. That is it. You are caught up.',
};
