import type { SourceItem } from '../types';

export const KC_SEED_SOURCE_ITEMS: SourceItem[] = [
  {
    id: 'kc-pounds-rapoport',
    sourceId: 'IAN_RAPOPORT',
    teamIds: ['KC', 'BAL'],
    type: 'TRADE',
    title: 'Ravens trade offensive tackle Diego Pounds to the Chiefs',
    excerpt:
      'NFL Network’s Ian Rapoport reported that Baltimore is trading offensive tackle Diego Pounds to Kansas City.',
    url: 'https://x.com/RapSheet/status/2093814946161185141',
    publishedAt: '2026-08-29T23:55:00.000Z',
    author: 'Ian Rapoport',
    entities: ['Diego Pounds', 'Kansas City Chiefs', 'Baltimore Ravens'],
    claims: ['Baltimore is trading Diego Pounds to Kansas City'],
    tags: ['offensive-line', 'roster-cuts'],
  },
  {
    id: 'kc-pounds-ravens-official',
    sourceId: 'BAL_RAVENS_OFFICIAL',
    teamIds: ['KC', 'BAL'],
    type: 'TRADE',
    title: 'Reports: Ravens trade offensive lineman Diego Pounds to Chiefs',
    excerpt:
      'Baltimore’s official site confirmed reports of the deal and noted that Pounds started 24 games at left tackle for Ole Miss.',
    url: 'https://www.baltimoreravens.com/news/diego-pounds-traded-ravens-to-chiefs-53-man-roster-cut-deadline-deal-2026',
    publishedAt: '2026-08-30T00:21:00.000Z',
    entities: ['Diego Pounds', 'Kansas City Chiefs', 'Baltimore Ravens'],
    claims: [
      'Baltimore is trading Diego Pounds to Kansas City',
      'Diego Pounds started 24 games at left tackle for Ole Miss',
    ],
    tags: ['offensive-line', 'roster-cuts'],
  },
  {
    id: 'kc-pounds-taylor-compensation',
    sourceId: 'NATE_TAYLOR',
    teamIds: ['KC', 'BAL'],
    type: 'TRADE',
    title: 'Chiefs compensation for Diego Pounds trade reported',
    excerpt:
      'ESPN’s Nate Taylor reported that Kansas City is sending Baltimore a conditional 2028 sixth-round pick for Pounds.',
    url: 'https://www.baltimoreravens.com/news/diego-pounds-traded-ravens-to-chiefs-53-man-roster-cut-deadline-deal-2026',
    publishedAt: '2026-08-30T00:25:00.000Z',
    author: 'Nate Taylor',
    entities: ['Diego Pounds', 'Kansas City Chiefs', 'Baltimore Ravens'],
    claims: ['Kansas City is sending a conditional 2028 sixth-round pick to Baltimore'],
    tags: ['offensive-line', 'draft-picks'],
  },
  {
    id: 'kc-pounds-yahoo-video',
    sourceId: 'YAHOO_SPORTS',
    originalSourceId: 'IAN_RAPOPORT',
    reportedBy: 'IAN_RAPOPORT',
    referencedSources: ['IAN_RAPOPORT'],
    teamIds: ['KC', 'BAL'],
    type: 'TRADE',
    title: 'Chiefs trade for tackle to boost offensive line',
    excerpt:
      'Yahoo video coverage framed the move as another attempt by Kansas City to reinforce its offensive-line depth entering the regular season.',
    url: 'https://sports.yahoo.com/videos/chiefs-trade-tackle-boost-offensive-012413856.html',
    publishedAt: '2026-08-30T01:24:00.000Z',
    entities: ['Diego Pounds', 'Kansas City Chiefs', 'Baltimore Ravens'],
    claims: ['Baltimore is trading Diego Pounds to Kansas City'],
    tags: ['offensive-line', 'analysis'],
    videoId: 'yahoo-kc-pounds',
  },
];
