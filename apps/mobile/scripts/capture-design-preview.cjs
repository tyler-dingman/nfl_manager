// Local visual QA only. All API calls are intercepted; preview credentials never reach a server.
const fs = require('node:fs');
const pathModule = require('node:path');
const previewTeam = process.env.PREVIEW_TEAM ?? 'KC';
const output = pathModule.resolve(
  __dirname,
  '../../../reports/mobile-screen-previews',
  previewTeam === 'KC' ? '.' : previewTeam,
);
fs.mkdirSync(output, { recursive: true });
const { chromium } = require('../../../node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() =>
    localStorage.setItem('dd.mobile.access', 'visual-preview-only'),
  );
  const previewPlayer = {
    id: 'roster1',
    firstName: 'Sample',
    lastName: 'Quarterback',
    position: 'QB',
    age: 25,
    rating: 86,
    baselineRating: 82,
    capHit: '$12.0M',
    contractYearsRemaining: 2,
    status: 'Active',
    expectedAnnualValue: 12,
  };
  const simulation = {
    seed: 'preview',
    season: 2026,
    currentWeek: 1,
    phase: 'week-1',
    teams: {
      [previewTeam]: {
        abbr: previewTeam,
        conference: 'AFC',
        division: 'West',
        overall: 85,
        record: { wins: 0, losses: 0, ties: 0 },
        pointsFor: 0,
        pointsAgainst: 0,
      },
    },
    games: [
      {
        id: 'game',
        week: 1,
        seasonType: 'REG',
        homeTeam: previewTeam,
        awayTeam: 'BAL',
        played: false,
        homeScore: null,
        awayScore: null,
        winner: null,
      },
    ],
    playoffs: null,
    draftOrder: [],
    transactions: [],
    completedAt: null,
  };
  let trade = { id: 'preview-trade', partnerTeamAbbr: 'ARI', sendAssets: [], receiveAssets: [] };
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const stories = [
      'Chiefs add veteran help up front',
      'A key receiver returns to full practice',
      'The final roster competition is taking shape',
    ].map((title, i) => ({
      id: 'sample-' + i,
      title,
      summary: [
        'Kansas City completed a move to reinforce the offensive line.',
        'The latest designation is an encouraging change from the previous session.',
        'Special-teams work is separating the last group of roster candidates.',
      ][i],
      whyItMatters: 'This development may affect early-season roles and roster decisions.',
      whatsNext: 'Watch the next official practice report or roster announcement.',
      status: i === 0 ? 'BREAKING' : 'DEVELOPING',
      importanceScore: 95 - i * 6,
      sources: [
        {
          id: 'fixture',
          sourceName: 'Chiefs Communications',
          sourceUrl: 'https://www.chiefs.com',
          isOfficialSource: true,
        },
      ],
      lastMaterialUpdateAt: new Date().toISOString(),
    }));
    let body = {};
    const params = new URL(route.request().url()).searchParams;
    if (path === '/api/mobile/search') body = { stories: [], players: [] };
    else if (path === '/api/search/suggestions') body = { suggestions: ['When do the Chiefs play next?', "What's the latest on Chiefs injuries?", 'How did the Chiefs do last game?'] };
    else if (path === '/api/search') body = { answer: 'Sample AI answer for homepage verification.', sources: [], blocks: [] };
    else if (path === '/api/content/homepage')
      body = {
        teamId: 'KC',
        threeAndOut: { current: { teamId: 'KC', teamName: 'Kansas City Chiefs', stories } },
        huddle: [
          'Protection plan gets another look',
          'Young defenders earn more first-team work',
          'Coaches clarify the return-role competition',
        ].map((headline, i) => ({
          id: 'preview-' + i,
          headline,
          summary: 'Sample sourced development for visual review.',
          category: 'PRACTICE',
          updatedAt: new Date().toISOString(),
          sourceCount: 2,
          sources: [],
        })),
        wire: [],
      };
    else if (path === '/api/film-room')
      body = {
        videos: [
          {
            id: 'film1',
            title: 'Breaking down the protection plan',
            description: 'Preview content',
            thumbnail: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=600',
            duration: '13:36',
            publishedAt: new Date().toISOString(),
            category: 'analysis',
            channel: { id: 'channel', name: 'Film Study', subscriberCount: 24000 },
            youtubeUrl: 'https://www.youtube.com',
            channelUrl: 'https://www.youtube.com',
          },
        ],
      };
    else if (path === '/api/mobile/front-office')
      body = {
        team: { abbr: 'KC', name: 'Kansas City Chiefs', logoUrl: '' },
        cap: { availableCap: 24000000, usedCap: 256000000, totalCap: 280000000 },
        roster: [],
        transactions: [],
        updatedAt: new Date().toISOString(),
      };
    else if (path === '/api/parlay-lab/events')
      body = {
        events: [
          {
            id: 'game1',
            week: 4,
            awayTeamId: 'KC',
            homeTeamId: 'BAL',
            kickoffAt: '2026-10-04T20:25:00Z',
          },
        ],
      };
    else if (path === '/api/parlay-lab/research' || path === '/api/parlay-lab/alt-stack')
      body = {
        markets: [
          {
            id: 'market1',
            eventId: 'game1',
            playerName: 'Sample quarterback',
            playerId: 'preview-qb',
            statId: 'passing_yards',
            period: 'game',
            normalizedKey: 'preview-qb-passing_yards',
            lineType: path.endsWith('alt-stack') ? 'alternate' : 'main',
            teamId: 'KC',
            marketType: 'PASSING_YARDS',
            side: 'OVER',
            line: 199.5,
            mainLine: 249.5,
            trend: {
              trendScore: 90,
              last5: { games: 5, hits: 5 },
              last10: { games: 10, hits: 10 },
              last20: { games: 20, hits: 18 },
              season: { games: 17, hits: 15 },
              last2Years: { games: 34, hits: 30 },
            },
            sportsbook: 'DraftKings',
            odds: -110,
            available: true,
          },
        ],
      };
    else if (path === '/api/trivia/events') body = { event: null };
    else if (path === '/api/three-and-out')
      body = { current: { teamId: 'KC', teamName: 'Kansas City Chiefs', stories } };
    else if (path === '/api/auth/me')
      body = {
        user: {
          id: 'preview-user',
          displayName: 'Preview Fan',
          primaryEmail: 'preview@example.test',
          avatarUrl: null,
        },
      };
    else if (path === '/api/user/home')
      body = { personalization: { primaryTeam: { teamId: previewTeam } } };
    else if (path === '/api/teams')
      body = [
        { abbr: 'KC', name: 'Kansas City Chiefs', colors: ['#E31837', '#FFB81C'], logoUrl: '' },
      ];
    else if (path === '/api/trivia/stats') body = { stats: { lifetimePoints: 2565 } };
    else if (path === '/api/trivia/leaderboard')
      body = { rows: [{ userId: 'preview-user', rank: 342 }] };
    else if (path === '/api/crew')
      body = {
        crew: {
          id: 'crew',
          role: 'OWNER',
          ownerUserId: 'preview-user',
          pendingInvites: [],
          name: 'The Huddle',
          teamAbbr: previewTeam,
          weeklyYards: 120,
          rank: 12,
          members: [
            {
              id: 'preview-user',
              displayName: 'Preview Fan',
              role: 'OWNER',
              weeklyYards: 120,
              lifetimeYards: 265,
            },
          ],
          activity: [],
        },
      };
    else if (path === '/api/user/preferences')
      body = {
        preferences: {
          preferredTeamId: previewTeam,
          emailEnabled: true,
          pushEnabled: true,
          showAroundLeague: true,
          autoplayVideo: false,
        },
      };
    else if (path === '/api/auth/identities') body = { identities: [] };
    else if (path === '/api/auth/config') body = { providers: { google: true }, email: true };
    else if (path === '/api/game-day/homepage') body = { game: null };
    else if (path === '/api/rewards')
      body = {
        rewards: {
          progress: { currentDriveYards: 65, lifetimeYards: 265, touchdowns: 2 },
          rewards: [],
          nextReward: null,
          yardsToNextReward: 35,
        },
      };
    else if (path === '/api/catch-up')
      body = {
        catchUp: {
          totalMeaningfulChanges: 3,
          eligible: true,
          teamName: 'Kansas City Chiefs',
          baselineAt: new Date().toISOString(),
          estimatedReadMinutes: 2,
          items: stories.map((story) => ({
            id: story.id,
            storyId: story.id,
            type: 'NEW',
            headline: story.title,
            summary: story.summary,
            whyItMatters: story.whyItMatters,
            whatChanged: null,
            sourceCount: 1,
            sources: story.sources,
          })),
        },
      };
    else if (path === '/api/user/notifications/unread-count') body = { count: 0 };
    else if (path === '/api/content/huddle')
      body = {
        briefings: [
          'Protection plan gets another look',
          'Young defenders earn more first-team work',
          'Coaches clarify the return-role competition',
        ].map((headline, i) => ({
          id: 'preview-' + i,
          headline,
          summary: 'A concise, sourced overview of what Chiefs fans should know right now.',
          category: ['AROUND THE TEAM', 'PRACTICE', 'WHAT THEY’RE SAYING'][i],
          updatedAt: new Date().toISOString(),
          sourceCount: 2,
          sources: [],
        })),
        pagination: { totalItems: 3, totalPages: 1, page: 1 },
      };
    const product = {
      id: 'preview-product',
      name: 'D&D Original Tee',
      category: 'Tees',
      type: 'TEE',
      price: 32,
      colors: ['Black', 'Cream'],
      sizes: ['S', 'M', 'L', 'XL'],
      badge: 'NEW ARRIVAL',
    };
    const order = {
      id: 'preview-order',
      order_number: 'DD-1001',
      created_at: new Date().toISOString(),
      fulfillment_status: 'NEW',
      payment_status: 'PAID',
      subtotal_cents: 3200,
      total_cents: 3899,
      discount_total_cents: 0,
      shipping_total_cents: 699,
      tax_total_cents: 0,
      refunded_total_cents: 0,
      shipping_address: {
        firstName: 'Preview',
        lastName: 'Fan',
        address1: '100 Sample Street',
        city: 'Kansas City',
        state: 'MO',
        postalCode: '64129',
      },
      items: [
        {
          id: 'item1',
          productName: product.name,
          variantLabel: 'Black / M',
          quantity: 1,
          lineTotalCents: 3200,
        },
      ],
      refunds: [],
    };
    if (path === '/api/mobile/merch') body = { categories: ['Tees'], products: [product] };
    if (path === '/api/user/onboarding') body = { onboarding: { completed: true, step: 5 } };
    if (path === '/api/user/profile')
      body = {
        profile: {
          displayName: 'Preview Fan',
          primaryEmail: 'preview@example.test',
          avatarUrl: null,
        },
      };
    if (path === '/api/user/saved-content')
      body = {
        items: [
          { id: 'saved1', contentType: 'STORY', contentId: stories[0].id, title: stories[0].title },
        ],
      };
    if (path.startsWith('/api/mobile/stories/')) body = stories[0];
    if (path.startsWith('/api/content/huddle/'))
      body = {
        id: 'preview-0',
        headline: stories[0].title,
        summary: stories[0].summary,
        whyItMatters: stories[0].whyItMatters,
        category: 'ROSTER',
        updatedAt: new Date().toISOString(),
        sourceCount: 1,
        sources: [
          { id: 'source', publisher: 'Team Communications', url: 'https://www.chiefs.com' },
        ],
      };
    if (path === '/api/user/notifications')
      body = {
        notifications: [
          {
            id: 'notice1',
            title: 'Your team briefing is ready',
            body: 'Catch up on the latest team developments.',
            createdAt: new Date().toISOString(),
            readAt: null,
            href: '/the-beat',
            type: 'TEAM_NEWS',
            category: 'TEAM_NEWS',
            deepLink: '/the-beat',
            priority: 'NORMAL',
            imageUrl: null,
          },
        ],
        nextCursor: null,
      };
    if (path === '/api/auth/sessions')
      body = {
        sessions: [
          {
            id: 'session1',
            userAgent: 'Preview device',
            lastUsedAt: new Date().toISOString(),
            revokedAt: null,
          },
        ],
      };
    if (path === '/api/commerce/orders') body = { orders: [order] };
    if (path.startsWith('/api/commerce/orders/')) body = { order };
    if (path === '/api/commerce/quote')
      body = {
        quote: {
          subtotalCents: 3200,
          discountCents: 0,
          shippingCents: 699,
          taxCents: 0,
          totalCents: 3899,
          promoCode: null,
        },
      };
    if (path === '/api/game-day/rooms') body = { room: null };
    if (path.startsWith('/api/mobile/players/'))
      body = {
        player: {
          id: 'preview-player',
          name: 'Sample Quarterback',
          position: 'QB',
          teamAbbr: previewTeam,
          age: 28,
          height: '6′ 3″',
          weight: 225,
          stats: { passingYards: 4200, passingTouchdowns: 32 },
        },
        contract: { capHit: 25000000, years: 3, guaranteed: 60000000, contractStatus: 'Active' },
        stories: [],
      };
    if (path === '/api/trivia/games' || path.startsWith('/api/trivia/games/'))
      body = {
        gameId: 'game1',
        position: 1,
        questionCount: 10,
        timerSeconds: 24,
        score: 0,
        correctAnswers: 0,
        completed: false,
        question: {
          category: 'TEAM_HISTORY',
          question: 'Which play changed the season?',
          answerA: 'A fourth-down stop',
          answerB: 'A kickoff return',
          answerC: 'An overtime drive',
          answerD: 'A field goal',
          presentedAt: new Date().toISOString(),
        },
      };
    if (path.startsWith('/api/trivia/games/')) body = { game: body };
    if (path === '/api/parlay-lab/research' && params.has('playerId')) {
      const hit = { hits: 7, games: 10, hitRate: 0.7, average: 265, median: 260 };
      body = {
        summary: {
          last5: hit,
          last10: hit,
          season: hit,
          last2Years: hit,
          home: hit,
          away: hit,
          vsOpponent: hit,
          average: 265,
          median: 260,
        },
        gameByGame: Array.from({ length: 10 }, (_, i) => ({
          gameId: 'g' + i,
          date: '2026-09-01',
          season: 2026,
          week: i + 1,
          opponent: 'BAL',
          homeAway: 'HOME',
          value: 220 + i * 10,
          line: 199.5,
          mainLine: 249.5,
          trend: {
            trendScore: 90,
            last5: { games: 5, hits: 5 },
            last10: { games: 10, hits: 10 },
            last20: { games: 20, hits: 18 },
            season: { games: 17, hits: 15 },
            last2Years: { games: 34, hits: 30 },
          },
          result: i > 2 ? 'HIT' : 'MISS',
          margin: 220 + i * 10 - 249.5,
          environment: { gameWindow: 'AFTERNOON' },
          venue: { environment: 'OUTDOOR' },
        })),
        lineLadder: { rows: [] },
        lineLadderInsight: 'Compare available thresholds.',
        generatedInsight: 'Sample research for visual review.',
        labMatchScore: 78,
        lineMargin: { averageMargin: 15.5 },
        usage: { trendLabel: 'Rising' },
        consistency: { label: 'Consistent' },
        distribution: { bins: [] },
        environment: { relevantSplits: [], insights: [] },
        venue: { relevantInsight: 'Outdoor venue.' },
      };
    }
    if (path === '/api/parlay-lab/alt-stack')
      body.events = [
        {
          id: 'game1',
          week: 4,
          homeTeamId: 'BAL',
          awayTeamId: 'KC',
          kickoffAt: '2026-10-04T20:25:00Z',
        },
      ];
    if (path === '/api/parlay-lab/alt-stack')
      body.markets.push({
        ...body.markets[0],
        id: 'market2',
        playerId: 'preview-qb2',
        playerName: 'Another quarterback',
      });
    if (path === '/api/content/next-game')
      body = {
        game: {
          id: 'preview-next',
          season: 2026,
          seasonType: 'REG',
          week: 4,
          homeTeam: previewTeam,
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
      };
    if (path === '/api/saves/create') body = { saveId: 'preview-save', year: 2026 };
    if (path === '/api/front-office/state') body = { state: { simulation } };
    if (path === '/api/front-office/simulate') body = { state: simulation };
    if (path === '/api/roster' || path === '/api/free-agents') body = [previewPlayer];
    if (path === '/api/draft/session/active') body = { session: null };
    if (path === '/api/front-office/draft-central')
      body = {
        draftYear: 2026,
        picks: [{ round: 1, displayOverall: 24 }],
        needs: ['WR', 'CB'],
        prospects: [
          {
            id: 'prospect1',
            name: 'Sample Receiver',
            position: 'WR',
            school: 'State University',
            height: '6-2',
            weight: 205,
            currentRank: 12,
            priorRank: 15,
            rankingTrend: 3,
            scoutGrade: 87,
            projectedPickLow: 10,
            projectedPickHigh: 25,
            summary: 'Reliable hands and separation at the top of routes.',
          },
        ],
        needAnalysis: [{ position: 'WR', score: 85, level: 'High' }],
        fits: [],
        news: [],
        week: 1,
        projectedSlot: 24,
        recommendations: [
          {
            title: 'Build through the draft',
            detail: 'Review your top needs before entering the draft room.',
          },
        ],
      };
    if (path === '/api/front-office/events')
      body = {
        events: [
          {
            id: 'welcome1',
            saveId: 'preview-save',
            type: 'welcome_message',
            priority: 2,
            headline: 'Welcome to the front office',
            summary: 'Build your roster and prepare for the season.',
            teamAbbr: previewTeam,
            metadata: { senderName: 'General Manager', senderRole: 'Front Office' },
            createdAt: new Date().toISOString(),
            dismissedAt: null,
          },
          {
            id: 'news1',
            saveId: 'preview-save',
            type: 'league_transaction',
            priority: 3,
            headline: 'A new chapter for the roster',
            summary: 'The team is evaluating its next move.',
            teamAbbr: previewTeam,
            metadata: {},
            createdAt: new Date().toISOString(),
            dismissedAt: null,
          },
        ],
      };
    if (path === '/api/front-office/trade-hub')
      body = {
        targets: [
          {
            ...previewPlayer,
            id: 'partner1',
            teamAbbr: 'ARI',
            tradeAvailabilityScore: 80,
            tradeValueScore: 70,
            estimatedCost: 'Day 2 pick',
            availabilityLabel: 'Available',
            whyAvailable: ['Roster depth'],
            depthPosition: 2,
            contractSummary: '2 years remaining',
          },
        ],
        outlooks: [],
        tradeEvents: [],
        recentTrades: [],
        deadline: { passed: false, label: 'Week 9' },
      };
    if (path === '/api/trades/create') body = { trade };
    if (path === '/api/trade-offers/assets')
      body = {
        user: { players: [previewPlayer], draftPicks: [] },
        partner: { players: [{ ...previewPlayer, id: 'partner1' }], draftPicks: [] },
      };
    if (path.endsWith('/add-asset')) {
      const payload = route.request().postDataJSON();
      const side = payload.side;
      trade = {
        ...trade,
        [side === 'send' ? 'sendAssets' : 'receiveAssets']: [
          {
            id: payload.playerId,
            type: 'player',
            side,
            label: 'Sample Quarterback',
            value: 100,
            playerId: payload.playerId,
          },
        ],
      };
      body = trade;
    }
    if (path.endsWith('/analyze'))
      body = {
        acceptance: 100,
        likelyAccepted: true,
        packageValues: { incoming: 100, outgoing: 100, difference: 0 },
        proposal: { isValid: true },
        caps: { userCapSpace: 24, partnerCapSpace: 30 },
      };
    if (previewTeam !== 'KC' && body.threeAndOut) {
      body.teamId = previewTeam;
      body.threeAndOut.current.teamId = previewTeam;
      body.threeAndOut.current.teamName = previewTeam;
    }
    if (path === '/api/film-room') body.videos = [body.videos[0], ...['Inside the passing game', 'Three matchups to watch'].map((title,i)=>({...body.videos[0],id:'film'+(i+2),title}))];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, path] of process.env.SMOKE_ONLY
    ? []
    : process.env.ALL_SCREENS
      ? [
          ['profile', '/profile'],
          ['saved', '/saved'],
          ['notifications', '/notifications'],
          ['notification-settings', '/notification-settings'],
          ['security', '/security'],
          ['crew', '/crew'],
          ['game-day', '/game-day'],
          ['catch-up', '/catch-up'],
          ['rewards', '/rewards'],
          ['search', '/search'],
          ['team-select', '/team-select'],
          ['story', '/story/sample-0'],
          ['beat-story', '/beat-story/preview-0'],
          ['player', '/player/preview-player'],
          ['merch', '/merch'],
          ['merch-product', '/merch-product/preview-product'],
          ['merch-cart', '/merch-cart'],
          ['merch-checkout', '/merch-checkout'],
          ['orders', '/orders'],
          ['order', '/order/preview-order'],
          ['trivia-game', '/trivia-game?mode=solo'],
        ]
      : process.env.PREVIEW_TEAM
        ? [
            ['home', '/'],
            ['the-beat', '/wire'],
            ['front-office', '/front-office'],
            ['parlay-lab', '/parlay-lab'],
          ]
        : [
            ['home', '/'],
            ['three-and-out', '/three'],
            ['the-beat', '/wire'],
            ['trivia', '/trivia'],
            ['account', '/account'],
            ['film-room', '/film-room'],
            ['front-office', '/front-office'],
            ['parlay-lab', '/parlay-lab'],
          ]) {
    await page.goto('http://127.0.0.1:8090' + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1800);
    const visibleText = await page.locator('body').innerText();
    if (/Uncaught Error|Log 1 of|Cannot read properties|Unable to resolve module/.test(visibleText))
      throw new Error(name + ': ' + visibleText.slice(0, 500));
    if (name === 'home') {
      await page.getByTestId('homepage-stadium-image').waitFor();
      await page.getByTestId('homepage-next-up').getByText('NEXT UP', { exact: true }).waitFor();
      await page.getByText('WEEK 4', { exact: true }).waitFor();
    }
    await page.screenshot({ path: pathModule.join(output, name + '.png') });
    if (name === 'home') {
      await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
      await page.getByText('YOUR TEAM', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Merch', exact: true }).waitFor();
      await page.waitForTimeout(600); // Let the native Modal entrance animation finish.
      await page.screenshot({ path: pathModule.join(output, 'menu-drawer.png') });
      await page.getByRole('button', { name: 'Close navigation menu', exact: true }).click();
      await page.waitForTimeout(600);
      await page.getByText('What ' + (previewTeam === 'SEA' ? 'Seattle Seahawks' : 'Kansas City Chiefs') + ' fans need to know', {exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'home-beat-cards.png') });
      await page.getByTestId('home-three-and-out').scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'home-three-and-out.png') });
      await page.getByTestId('home-film-room').scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'home-film-room.png') });
      await page.getByTestId('home-ai-search').scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'home-search.png') });
      await page.getByText('Build the complete picture', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'home-bottom.png') });
      await page.getByTestId('home-ai-search').scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Catch me up today', exact: true }).click();
      await page.getByTestId('home-ai-answer').waitFor();
      await page.getByText('Sample AI answer for homepage verification.', { exact: true }).waitFor();
      if (new URL(page.url()).pathname === '/search') throw new Error('Homepage AI search navigated away');
      await page.getByTestId('home-ai-answer').scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'home-ai-answer.png') });
      await page.getByRole('button', { name: 'Clear AI search', exact: true }).click();
      await page.getByTestId('home-ai-answer').waitFor({ state: 'hidden' });
      await page.waitForTimeout(600);

    }
    if (name === 'parlay-lab') {
      await page.getByRole('button', { name: 'Explore Parlay Lab', exact: true }).click();
      await page.getByRole('button', { name: 'Close section navigation', exact: true }).waitFor();
      await page.screenshot({path:pathModule.join(output,'parlay-secondary-navigation.png')});
      await page.getByRole('button', { name: 'Close section navigation', exact: true }).click();

      await page.waitForTimeout(400);
      await page.getByLabel('Search', { exact: true }).click();
      await page.getByLabel('Search Down & Distance', { exact: true }).waitFor();
      await page.getByText('When do the Chiefs play next?', { exact: true }).waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({path:pathModule.join(output,'search-overlay.png')});
      await page.getByRole('button', { name: 'Close search', exact: true }).click();
      await page.getByTestId('parlay-alt-promotion').scrollIntoViewIfNeeded();
      await page.screenshot({path:pathModule.join(output,'parlay-home-alt.png')});
      await page.getByTestId('lab-score-guide').scrollIntoViewIfNeeded();
      await page.screenshot({path:pathModule.join(output,'parlay-home-footer.png')});
    }
    if (name === 'front-office') {
      await page.getByText('THE FRANCHISE LIFECYCLE', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: pathModule.join(output, 'front-office-paths.png') });
    }
    console.log(name, (await page.locator('body').innerText()).slice(0, 350));
  }
  await page.goto('http://127.0.0.1:8090/account', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('switch').first().waitFor();
  await page.getByRole('tab', { name: 'Parlay Lab', exact: true }).click();
  await page.getByText('Sample quarterback', { exact: true }).last().click();
  if (process.env.FLOWS) {
    await page.getByText('GAME-BY-GAME PERFORMANCE', { exact: true }).waitFor();
    for (const tab of ['Overview', 'Game Log', 'Matchup', 'Splits', 'Line Ladder']) {
      await page.getByText(tab, { exact: true }).click();
      await page.screenshot({
        path: pathModule.join(
          output,
          'parlay-research-' + tab.toLowerCase().replaceAll(' ', '-') + '.png',
        ),
      });
    }
  }
  await page.getByRole('button', { name: 'Close research' }).click();
  if (process.env.FLOWS) {
    await page.goto('http://127.0.0.1:8090/front-office', { waitUntil: 'networkidle' });
    await page.getByText('START THE SEASON →', { exact: true }).click();
    await page.getByRole('button', { name: 'Franchise sections' }).waitFor();
    for (const section of [
      'Roster',
      'Free Agency',
      'Draft',
      'Development',
      'League News',
      'Messages',
      'Ownership',
      'Schedule',
      'Standings',
      'Transactions',
      'Settings',
      'Trades',
    ]) {
      await page.getByRole('button', { name: 'Franchise sections' }).click();
      await page.getByRole('button', { name: section, exact: true }).click();
      await page.waitForTimeout(400);
      const text = await page.locator('body').innerText();
      if (/Uncaught Error|Log 1 of|Cannot read properties/.test(text))
        throw new Error(section + ': ' + text);
      await page.screenshot({
        path: pathModule.join(
          output,
          'franchise-' + section.toLowerCase().replaceAll(' ', '-') + '.png',
        ),
      });
    }
    for (const section of [
      'Trade Finder',
      'Find Trade Partners',
      'My Trade Offers',
      'Trade Block',
      'Recently Viewed',
      'League Trade Activity',
      'Build Trade',
    ]) {
      await page.getByRole('button', { name: 'Trade tools', exact: true }).click();
      await page.getByRole('button', { name: section, exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: pathModule.join(
          output,
          'trade-' + section.toLowerCase().replaceAll(' ', '-') + '.png',
        ),
      });
    }
    await page.getByText('BUILD TRADE', { exact: true }).click();
    await page.getByText('ADD PLAYER OR PICK +', { exact: true }).first().click();
    await page.getByText('Sample Quarterback', { exact: true }).click();
    await page.getByText('ADD PLAYER OR PICK +', { exact: true }).last().click();
    await page.getByText('Sample Quarterback', { exact: true }).last().click();
    await page.getByText('EVALUATE TRADE', { exact: true }).click();
    await page.getByText('TRADE REVIEW', { exact: true }).waitFor();
    await page.getByText('TRADE REVIEW', { exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: pathModule.join(output, 'franchise-trade-review.png') });
    await page.getByRole('button', { name: 'Franchise sections' }).click();
    await page.getByRole('button', { name: 'Draft', exact: true }).click();
    for (const section of [
      'Big Board',
      'Position Rankings',
      'Draft Guide',
      'Team Needs',
      'My Drafts',
      'Draft Room',
    ]) {
      await page.getByRole('button', { name: 'Draft sections', exact: true }).click();
      await page.getByRole('button', { name: section, exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: pathModule.join(
          output,
          'draft-' + section.toLowerCase().replaceAll(' ', '-') + '.png',
        ),
      });
    }
    await page.goto('http://127.0.0.1:8090/parlay-lab', { waitUntil: 'networkidle' });
    for (const section of [
      'Players',
      'Teams',
      'Games',
      'Trends',
      'Parlay Generator',
      'Alt Stack',
      'My Parlays',
      'Settings',
    ]) {
      await page.getByRole('button', { name: 'Explore Parlay Lab', exact: true }).click();
      await page.getByRole('button', { name: section, exact: true }).click();
      await page.waitForTimeout(400);
      const text = await page.locator('body').innerText();
      if (/Uncaught Error|Log 1 of|Cannot read properties/.test(text))
        throw new Error(section + ': ' + text);
      await page.screenshot({
        path: pathModule.join(
          output,
          'parlay-' + section.toLowerCase().replaceAll(' ', '-') + '.png',
        ),
      });
    }
    await page.getByRole('button', { name: 'Explore Parlay Lab', exact: true }).click();
    await page.getByRole('button', { name: 'Parlay Generator', exact: true }).click();
    await page.getByLabel('Describe your parlay').fill('1 leg with the highest Lab Score');
    await page.getByRole('button', { name: 'GENERATE PARLAY', exact: true }).click();
    await page.getByRole('button', { name: 'ADD ALL TO MY PARLAY', exact: true }).click();
    await page
      .getByText('Added to My Parlay. Review and save your build below.', { exact: true })
      .waitFor();
    await page.screenshot({ path: pathModule.join(output, 'parlay-generator-results.png') });
    await page.getByRole('button', { name: 'Explore Parlay Lab', exact: true }).click();
    await page.getByRole('button', { name: 'Alt Stack', exact: true }).click();
    await page.getByRole('button', { name: 'Legs: 8', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByText('GENERATE ALT STACK', { exact: true }).click();
    await page.getByText('ADD STACK TO MY PARLAY', { exact: true }).click();
    await page
      .getByText('Added to My Parlay below. Review and save when ready.', { exact: true })
      .waitFor();
    await page.screenshot({ path: pathModule.join(output, 'parlay-alt-stack-results.png') });
    console.log(
      'PASS: research tabs, franchise sections, trade asset selection/evaluation, and Parlay Lab menus.',
    );
  }

  if (process.env.STATES) {
    await page.route('**/api/user/profile', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Profile temporarily unavailable.' }),
      }),
    );
    await page.goto('http://127.0.0.1:8090/profile', { waitUntil: 'networkidle' });
    await page.getByText('Profile unavailable', { exact: true }).waitFor();
    if (await page.getByText('SAVE PROFILE', { exact: true }).count())
      throw new Error('Failed profile load exposes save form');
    await page.screenshot({ path: pathModule.join(output, 'profile-error.png') });
    await page.unroute('**/api/user/profile');
    await page.route('**/api/parlay-lab/research*', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unavailable' }),
      }),
    );
    await page.goto('http://127.0.0.1:8090/parlay-lab', { waitUntil: 'networkidle' });
    await page.getByText(/Parlay Lab is temporarily unavailable/).waitFor();
    await page.screenshot({ path: pathModule.join(output, 'parlay-error.png') });
    await page.unroute('**/api/parlay-lab/research*');
    const signedOut = await browser.newContext({
      viewport: { width: 412, height: 892 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await signedOut.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: null, providers: { google: false, apple: false } }),
      }),
    );
    const login = await signedOut.newPage();
    login.on('pageerror', (e) => errors.push(e.message));
    await login.goto('http://127.0.0.1:8090/sign-in', { waitUntil: 'networkidle' });
    await login.getByText('Welcome back.', { exact: true }).waitFor();
    await login.screenshot({ path: pathModule.join(output, 'sign-in.png') });
    await signedOut.close();
    console.log(
      'PASS: profile load failure prevents saving, Parlay failure is visible, signed-out login renders.',
    );
  }

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'PASS: main screens render, account preferences expand, bottom navigation opens Parlay Lab, research opens and closes.',
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
