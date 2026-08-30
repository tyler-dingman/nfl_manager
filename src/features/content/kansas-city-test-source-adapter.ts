import type { ContentSource, ContentSourceAdapter } from './types';

export class KansasCityTestSourceAdapter implements ContentSourceAdapter {
  async collect(teamAbbr: string): Promise<ContentSource[]> {
    if (teamAbbr !== 'KC') return [];

    return [
      {
        id: 'KC-diego-pounds-rapoport',
        teamAbbr,
        kind: 'reporting',
        publisher: 'Ian Rapoport',
        title: 'Ravens trade offensive tackle Diego Pounds to the Chiefs',
        url: 'https://x.com/RapSheet/status/2093814946161185141',
        publishedAt: '2026-08-29T23:55:00.000Z',
        excerpt:
          'NFL Network’s Ian Rapoport reported that Baltimore is trading offensive tackle Diego Pounds to Kansas City. The undrafted rookie from Ole Miss now lands with the Chiefs just before final roster decisions.',
        topicKey: 'diego-pounds-trade',
        importance: 100,
      },
      {
        id: 'KC-diego-pounds-ravens',
        teamAbbr,
        kind: 'official',
        publisher: 'Baltimore Ravens',
        title: 'Reports: Ravens trade offensive lineman Diego Pounds to Chiefs',
        url: 'https://www.baltimoreravens.com/news/diego-pounds-traded-ravens-to-chiefs-53-man-roster-cut-deadline-deal-2026',
        publishedAt: '2026-08-30T00:21:00.000Z',
        excerpt:
          'Baltimore’s official site confirmed reports of the deal and noted that Pounds started 24 games at left tackle for Ole Miss. ESPN’s Nate Taylor reported that Kansas City is sending a conditional 2028 sixth-round pick to Baltimore.',
        topicKey: 'diego-pounds-trade',
        importance: 100,
      },
      {
        id: 'KC-diego-pounds-yahoo',
        teamAbbr,
        kind: 'video',
        publisher: 'Yahoo Sports',
        title: 'Chiefs trade for tackle to boost offensive line',
        url: 'https://sports.yahoo.com/videos/chiefs-trade-tackle-boost-offensive-012413856.html',
        publishedAt: '2026-08-30T01:24:00.000Z',
        excerpt:
          'Video coverage framed the move as another attempt by Kansas City to reinforce its offensive-line depth entering the regular season.',
        topicKey: 'diego-pounds-trade',
        importance: 95,
      },
      {
        id: 'KC-diego-pounds-instagram',
        teamAbbr,
        kind: 'social',
        publisher: 'Instagram',
        title: 'Chiefs–Ravens trade reaction',
        url: 'https://www.instagram.com/p/Dco6zRnp9uz/',
        publishedAt: '2026-08-30T01:00:00.000Z',
        excerpt:
          'Social coverage quickly amplified the trade as Chiefs fans evaluated where Pounds could fit on the offensive-line depth chart.',
        topicKey: 'diego-pounds-trade',
        importance: 80,
      },
      {
        id: 'KC-chiefs-seahawks-recap',
        teamAbbr,
        kind: 'official',
        publisher: 'Kansas City Chiefs',
        title: 'Chiefs and Seahawks play to a draw in preseason finale',
        url: 'https://www.chiefs.com/news/chiefs-and-seahawks-play-to-a-draw-in-preseason-finale',
        publishedAt: '2026-08-29T21:13:00.000Z',
        excerpt:
          'Kansas City finished the preseason with a 9–9 tie against Seattle after a potential game-winning 52-yard field goal missed as time expired. The Chiefs emphasized the value of the final game repetitions for young players competing for roster spots.',
        topicKey: 'preseason-finale',
        importance: 70,
      },
      {
        id: 'KC-kcsn-postgame',
        teamAbbr,
        kind: 'video',
        publisher: 'KC Sports Network',
        title: 'Chiefs tie Seahawks 9–9 in 2026 preseason finale: postgame show',
        url: 'https://podfollow.com/kc-sports-network-kansas-city-chiefs-podcasts/episode/c0bac4e2358ce04e83a56a8e204b4c4ee2854b91/view',
        publishedAt: '2026-08-29T04:29:00.000Z',
        excerpt:
          'Local postgame coverage centered on what the finale revealed about the bottom of the roster as Kansas City moves from preseason evaluation to final personnel decisions.',
        topicKey: 'preseason-finale',
      },
      {
        id: 'KC-reddit-postgame',
        teamAbbr,
        kind: 'social',
        publisher: 'r/KansasCityChiefs',
        title: 'Chiefs–Seahawks postgame discussion',
        url: 'https://www.reddit.com/r/KansasCityChiefs/comments/1w1b47s/post_game_thread_seattle_seahawks_kansas_city/',
        publishedAt: '2026-08-29T05:00:00.000Z',
        excerpt:
          'The active fan discussion following the tie focused on individual performances and which young players made the strongest final case for a roster spot.',
        topicKey: 'preseason-finale',
      },
    ];
  }
}
