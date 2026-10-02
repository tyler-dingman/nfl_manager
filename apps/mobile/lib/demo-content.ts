import type { MobileFilmVideo } from './api';
import type { ParlayEvent, ParlayMarket } from './parlay';
/** Fictional, local preview content; never represented as current news or betting lines. */
export const demoVideos: MobileFilmVideo[] = [
  'Breaking down the protection plan',
  'Inside the passing game',
  'Three matchups to watch',
].map((title, i) => ({
  id: `demo-film-${i}`,
  title: `Preview: ${title}`,
  description: 'Sample video card for reviewing the app design.',
  thumbnail: 'https://www.downdistance.com/images/video/studio_desk.png',
  duration: ['13:36', '8:42', '21:05'][i],
  publishedAt: '2026-09-27T17:00:00Z',
  category: 'analysis',
  channel: { id: 'demo-channel', name: 'Preview Film Study', subscriberCount: 24000 },
  youtubeUrl: 'https://www.youtube.com/@KansasCityChiefs',
  channelUrl: 'https://www.youtube.com/@KansasCityChiefs',
}));
export const demoEvents: ParlayEvent[] = [
  {
    id: 'demo-game',
    week: 4,
    homeTeamId: 'KC',
    awayTeamId: 'LV',
    kickoffAt: '2026-10-04T17:00:00Z',
  },
];
export const demoMarkets: ParlayMarket[] = [
  ['Sample quarterback', 'PASSING_YARDS', 'passing_yards', 249.5],
  ['Sample receiver', 'RECEIVING_YARDS', 'receiving_yards', 64.5],
  ['Sample running back', 'RUSHING_YARDS', 'rushing_yards', 59.5],
].map(([name, marketType, statId, line], i) => ({
  entityId: `demo-player-${i}`,
  isAltLine: false,
  deeplink: null,
  id: `demo-market-${i}`,
  eventId: 'demo-game',
  playerName: String(name),
  playerId: `demo-player-${i}`,
  statId: String(statId),
  period: 'game',
  normalizedKey: `demo-${statId}`,
  lineType: 'main',
  teamId: 'KC',
  marketType: String(marketType),
  side: 'OVER',
  line: Number(line),
  mainLine: Number(line),
  trend: {
    vsOpponent: {games: 0, hits: 0, hitRate: null, average: null}, home: {games: 8, hits: 5, hitRate: .625, average: Number(line)+8}, away: {games: 9, hits: 6, hitRate: .667, average: Number(line)+6}, average: Number(line)+7, median: Number(line)+4, recentAverage5: Number(line)+12, recentAverage10: Number(line)+9, max: Number(line)+60, streakType: 'OVER', streakLength: 2, sampleConfidence: 'MEDIUM', gameLog: [],
    trendScore: 80 + i,
    last5: { games: 5, hits: 4, hitRate: 0.8 },
    last10: { games: 10, hits: 7, hitRate: 0.7 },
    last20: { games: 20, hits: 13, hitRate: 0.65 },
    season: { games: 17, hits: 11, hitRate: 0.6470588235294118 },
    last2Years: { games: 34, hits: 23, hitRate: 0.6764705882352942 },
  },
  sportsbook: 'DRAFTKINGS',
  odds: -110,
  available: true,
}));
