import { createDemoHuddle } from './demo-huddle';
import { demoVideos, demoMarkets, demoEvents } from './demo-content';
import { fixtureHome } from './fixtures';

// This local session never issues tokens or grants access to a server account.
export function createDemoSession() {
  let active = false;
  const huddle = createDemoHuddle();
  let selectedTeam: string | null = null;
  let onboarding = { completed: false, step: 1 };
  let delivery = { enabled: false, push: false, email: false, sms: false, deliveryTime: '07:00', timezone: 'America/Chicago', accountEmail: 'test@gmail.com', emailAvailable: true, smsDeliveryPending: true };

  const user = {
    id: 'local-demo',
    displayName: 'Test Fan',
    primaryEmail: 'test@gmail.com',
    avatarUrl: null,
  };
  return {
    isActive: () => active,
    user,
    login(enabled: boolean, email: string, password: string) {
      if (!enabled || email.trim().toLowerCase() !== 'test@gmail.com') return null;
      if (password !== 'test') throw new Error('The demo password is test.');
      active = true;
      return user;
    },
    logout() {
      active = false;
    },
    respond(path: string, init: RequestInit = {}) {
      if (!active) throw new Error('No demo session.');
      const pathname = path.split('?')[0];
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (pathname === '/api/huddle') return json(huddle(new URL(path, 'https://preview.local').searchParams.get('team') ?? selectedTeam ?? 'KC', init.method === 'POST' ? JSON.parse(String(init.body ?? '{}')) : undefined));
      // Preview-only canonical settings simulation. No server identity or tokens.
      const method = (init.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && ['/api/user/onboarding', '/api/user/team-follows/primary', '/api/three-and-out/preferences'].includes(pathname)) {
        let body;
        try { body = JSON.parse(String(init.body ?? '{}')); } catch { return json({ error: 'Invalid settings' }, 400); }
        if (pathname === '/api/user/onboarding') { onboarding = { ...onboarding, ...body }; return json({ onboarding }); }
        if (pathname === '/api/user/team-follows/primary') { selectedTeam = body.teamId; return json({ ok: true }); }
        delivery = { ...delivery, ...body }; return json({ preferences: delivery });
      }
      // Isolated, explicitly labelled sample response; never calls the live AI service.
      if (pathname === '/api/search' && init.method?.toUpperCase() === 'POST') {
        let query = '';
        try { query = JSON.parse(String(init.body ?? '{}')).query ?? ''; } catch { return json({ error: 'Invalid search request.' }, 400); }
        return json({
          query,
          answer: 'Sample answer for design preview: Kansas City Chiefs 24, Miami Dolphins 10 — final. This is fictional sample data, not a live game result. [1]',
          answerType: 'GENERAL_TEAM_QUESTION',
          blocks: [{ type: 'gameCard', timeZone: 'America/Chicago', game: {
            id: 'demo-search-game', home: 'MIA', away: 'KC', startsAt: '2026-09-27T17:00:00Z', week: 3,
            venue: 'Sample stadium', network: 'Sample broadcast', status: 'final', homeScore: 10, awayScore: 24, timeTbd: false,
            source: { id: 'demo', title: 'Sample data — design preview', url: '/sources' },
          } }],
          results: [], sources: [{ id: 'demo', title: 'Sample data — design preview', url: '/sources' }],
          timing: { totalMs: 0, lexicalMs: 0, vectorMs: null, answerMs: 0 },
        });
      }
      if ((init.method ?? 'GET').toUpperCase() !== 'GET')
        return json(
          {
            error:
              'This action is unavailable in the demo. Sign in with a real account to save changes.',
          },
          403,
        );
      const team = {
        abbr: 'KC',
        name: 'Kansas City Chiefs',
        colors: ['#E31837', '#FFB81C'],
        logoUrl: '',
      };
      const data: Record<string, unknown> = {
        '/api/user/onboarding': { onboarding },
        '/api/three-and-out/preferences': { preferences: delivery },
        '/api/user/notification-preferences': { preferences: [] },
        '/api/auth/me': { user },
        '/api/auth/config': { ok: true, providers: {}, email: true },
        '/api/auth/identities': { identities: [] },
        '/api/user/home': { personalization: { primaryTeam: { teamId: selectedTeam ?? 'KC' } } },
        '/api/user/profile': {
          profile: {
            ...user,
            createdAt: '2026-09-28T12:00:00Z',
            firstName: 'Test',
            lastName: 'Fan',
            timezone: 'America/Chicago',
            locale: 'en',
          },
        },
        '/api/user/preferences': {
          preferences: {
            preferredTeamId: selectedTeam,
            intensity: 'CASUAL',
            emailEnabled: false,
            pushEnabled: false,
            showAroundLeague: true,
            autoplayVideo: false,
            advancedNotifications: {},
          },
        },
        '/api/teams': [team],
        '/api/content/homepage': fixtureHome,
        '/api/three-and-out': fixtureHome.threeAndOut,
        '/api/content/wire': { entries: fixtureHome.wire },
        '/api/content/huddle': {
          briefings: fixtureHome.huddle,
          pagination: { totalItems: fixtureHome.huddle.length, totalPages: 1, page: 1 },
        },
        '/api/film-room': { videos: demoVideos },
        '/api/mobile/front-office': {
          team,
          updatedAt: new Date().toISOString(),
          cap: { availableCap: 24000000, usedCap: 256000000, totalCap: 280000000 },
          roster: [],
          transactions: [],
          availability: { depthChart: false, injuries: false },
        },
        '/api/parlay-lab/events': { events: demoEvents },
        '/api/parlay-lab/research': { markets: demoMarkets },
        '/api/parlay-lab/alt-stack': { markets: demoMarkets },
        '/api/parlay-lab/players': { players: [] },
        '/api/parlay-lab/my-plays': { plays: [] },
        '/api/trivia/stats': { stats: { lifetimePoints: 2565 } },
        '/api/trivia/leaderboard': { rows: [{ userId: user.id, rank: 342 }] },
        '/api/trivia/events': { event: null },
        '/api/crew': { crew: null },
        '/api/game-day/homepage': { game: null },
        '/api/content/next-game': {
          game: {
            id: 'demo-next-game',
            season: 2026,
            seasonType: 'REG',
            week: 4,
            homeTeam: 'KC',
            awayTeam: 'LV',
            kickoffAt: '2026-10-04T17:00:00Z',
            kickoffConfirmed: true,
            status: 'SCHEDULED',
            homeScore: null,
            awayScore: null,
            overtime: false,
            venue: 'GEHA Field at Arrowhead Stadium',
            broadcastNetwork: null,
          },
          betting: null,
        },
        '/api/game-day/rooms': { room: null },
        '/api/rewards': {
          rewards: {
            nextReward: null,
            yardsToNextReward: 0,
            progress: { currentDriveYards: 65, touchdowns: 2, lifetimeYards: 265 },
            rewards: [],
          },
        },
        '/api/user/notifications/unread-count': { count: 0 },
        '/api/user/notifications': { notifications: [], nextCursor: null },
        '/api/user/saved-content': { items: [] },
        '/api/mobile/merch': { categories: [], products: [] },
        '/api/commerce/orders': { orders: [] },
        '/api/mobile/search': { stories: [], players: [] },
      };
      const briefing = fixtureHome.huddle.find(
        (item) => pathname === `/api/content/huddle/${item.id}`,
      );
      if (briefing) return json(briefing);
      return pathname in data
        ? json(data[pathname])
        : json({ error: 'This feature is unavailable in the demo.' }, 503);
    },
  };
}
export const demoSession = createDemoSession();
