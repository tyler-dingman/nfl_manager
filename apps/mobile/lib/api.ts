import { fixtureHome } from './fixtures';
import type {
  CatchUpData,
  DailyTrivia,
  DailyTriviaResult,
  HomeData,
  Story,
  ThreePackage,
  TriviaChoice,
  TriviaGame,
  TriviaGameResult,
  TriviaGroupRoom,
  WireEntry,
  GameDayRoom,
} from './types';
import { authenticatedFetch } from './auth';
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
export const TEAM_ID = process.env.EXPO_PUBLIC_TEAM_ID ?? 'KC';
export const USE_FIXTURES = process.env.EXPO_PUBLIC_USE_FIXTURES === 'true';
async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`D&D API ${response.status}`);
  return response.json() as Promise<T>;
}
export type HomepageGame = {
  id: string;
  weekNumber: number;
  startsAt: string;
  timeZone: string;
  teamAbbr: string;
  teamName: string;
  opponentAbbr: string;
  opponentName: string;
  venue: string | null;
  weather: { temperature: number; condition: string } | null;
  betting: { spread: string | null; overUnder: number | null } | null;
  state: 'PREGAME' | 'LIVE' | 'FINAL';
  devOverride?: boolean;
};
export async function getHomepageGame(teamId: string) {
  return (await request<{ game: HomepageGame | null }>(`/api/game-day/homepage?team=${teamId}`))
    .game;
}
export async function getGameDayRoom(teamId: string, roomId?: string) {
  const r = await authenticatedFetch(
    roomId ? `/api/game-day/rooms/${roomId}` : `/api/game-day/rooms?team=${teamId}`,
  );
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || 'Game Day is unavailable.');
  return b.room as GameDayRoom | null;
}
export async function createGameDayRoom(teamId: string) {
  const r = await authenticatedFetch('/api/game-day/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'CREATE', teamId }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || 'Unable to create tailgate.');
  return b.id as string;
}
export async function gameDayAction(roomId: string, body: object) {
  const r = await authenticatedFetch(`/api/game-day/rooms/${roomId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.error || 'Unable to update the room.');
}
export async function getHome(teamId = TEAM_ID): Promise<{ data: HomeData; fixture: boolean }> {
  if (USE_FIXTURES) return { data: fixtureHome, fixture: true };
  const data = await request<HomeData>(`/api/content/homepage?team=${teamId}`);
  return { data, fixture: false };
}
export async function getThree(teamId = TEAM_ID): Promise<ThreePackage> {
  if (USE_FIXTURES) return fixtureHome.threeAndOut!;
  return request<ThreePackage>(`/api/three-and-out?team=${teamId}`);
}
export async function getWire(teamId = TEAM_ID): Promise<WireEntry[]> {
  if (USE_FIXTURES) return fixtureHome.wire;
  return (await request<{ entries: WireEntry[] }>(`/api/content/wire?team=${teamId}`)).entries;
}
export async function getCatchUp(teamId = TEAM_ID): Promise<CatchUpData> {
  const response = await authenticatedFetch(`/api/catch-up?team=${teamId}`);
  const body = (await response.json().catch(() => null)) as {
    catchUp?: CatchUpData;
    error?: string;
  } | null;
  if (!response.ok || !body?.catchUp)
    throw new Error(body?.error ?? 'Get Caught Up is unavailable.');
  return body.catchUp;
}
export async function completeCatchUp(teamId = TEAM_ID) {
  const response = await authenticatedFetch('/api/catch-up/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId }),
  });
  if (!response.ok) throw new Error('Unable to save your catch-up progress.');
}
export async function getDailyTrivia(teamId = TEAM_ID): Promise<DailyTrivia> {
  const response = await authenticatedFetch(`/api/trivia/daily?team=${teamId}`);
  const body = (await response.json().catch(() => null)) as
    | (DailyTrivia & { error?: string })
    | null;
  if (!response.ok || !body?.dailyQuestion)
    throw new Error(body?.error ?? 'Today’s Trivia question is unavailable.');
  return body;
}
export async function answerDailyTrivia(
  teamId: string,
  input: {
    dailyQuestionId: string;
    questionId: string;
    selectedAnswer: TriviaChoice;
    responseTimeMs: number;
  },
): Promise<DailyTriviaResult> {
  const response = await authenticatedFetch('/api/trivia/daily/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, ...input }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    result?: { correct: boolean; points: number };
    answer?: TriviaChoice;
    explanation?: string;
  } | null;
  if (!response.ok || !body?.result || !body.answer)
    throw new Error(body?.error ?? 'Unable to submit your answer.');
  return { ...body.result, answer: body.answer, explanation: body.explanation ?? '' };
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `D&D API ${response.status}`);
  return body;
}
export async function startTriviaGame(teamId = TEAM_ID) {
  const body = await authJson<{ gameId: string }>('/api/trivia/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId }),
  });
  return getTriviaGame(body.gameId);
}
export async function getTriviaGame(gameId: string) {
  return (await authJson<{ game: TriviaGame }>(`/api/trivia/games/${gameId}`)).game;
}
export async function answerTriviaGame(gameId: string, selectedAnswer: TriviaChoice | null) {
  return (
    await authJson<{ result: TriviaGameResult }>(`/api/trivia/games/${gameId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedAnswer }),
    })
  ).result;
}
export async function createTriviaGroup(teamId: string) {
  return authJson<{ gameId: string; joinCode: string; inviteToken: string }>('/api/trivia/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId }),
  });
}
export async function joinTriviaGroup(joinCode: string) {
  return authJson<{ gameId: string }>(
    `/api/trivia/groups/${encodeURIComponent(joinCode.toUpperCase())}/join`,
    { method: 'POST' },
  );
}
export async function getTriviaGroup(joinCode: string) {
  return (
    await authJson<{ room: TriviaGroupRoom }>(
      `/api/trivia/groups/${encodeURIComponent(joinCode.toUpperCase())}`,
    )
  ).room;
}
export async function startTriviaGroup(joinCode: string) {
  return authJson<{ gameId: string }>(
    `/api/trivia/groups/${encodeURIComponent(joinCode.toUpperCase())}/start`,
    { method: 'POST' },
  );
}
export type TeamOption = { abbr: string; name: string; colors: [string, string]; logoUrl: string };
export async function getTeams() {
  return request<TeamOption[]>('/api/teams');
}
export type RewardsDashboard = {
  progress: { currentDriveYards: number; touchdowns: number; lifetimeYards: number };
  yardsToNextReward: number;
  nextReward: null | { title: string; thresholdYards: number };
  rewards: Array<{
    id: string;
    title: string;
    description: string;
    thresholdYards: number;
    status: string;
    couponCode?: string | null;
  }>;
};
export async function getRewards() {
  return (await authJson<{ rewards: RewardsDashboard }>('/api/rewards')).rewards;
}
export async function claimReward(rewardId: string) {
  return authJson(`/api/rewards/${rewardId}/claim`, { method: 'POST' });
}
export type SavedItem = {
  id: string;
  contentType: string;
  contentId: string;
  title: string;
  href?: string | null;
  createdAt?: string;
};
export async function getSavedContent() {
  return (await authJson<{ items: SavedItem[] }>('/api/user/saved-content')).items;
}
export async function saveStory(story: Story) {
  return authJson('/api/user/saved-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: 'STORY',
      contentId: story.id,
      title: story.title,
      href: `/story/${story.id}`,
    }),
  });
}
export async function removeSavedContent(contentType: string, contentId: string) {
  return authJson(
    `/api/user/saved-content?contentType=${encodeURIComponent(contentType)}&contentId=${encodeURIComponent(contentId)}`,
    { method: 'DELETE' },
  );
}
export type MobileNotification = {
  id: string;
  title: string;
  body: string;
  deepLink: string | null;
  imageUrl: string | null;
  category: string;
  priority: string;
  createdAt: string;
  readAt: string | null;
};
export async function getNotifications() {
  return authJson<{ notifications: MobileNotification[]; nextCursor: string | null }>(
    '/api/user/notifications?limit=50',
  );
}
export async function getUnreadNotificationCount() {
  return (await authJson<{ count: number }>('/api/user/notifications/unread-count')).count;
}
export async function updateNotifications(
  action: 'read-all' | 'seen' | 'read',
  notificationId?: string,
) {
  return authJson('/api/user/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...(notificationId ? { notificationId } : {}) }),
  });
}
export type MobileBriefing = {
  id: string;
  headline: string;
  summary: string;
  whyItMatters?: string;
  category: string;
  updatedAt: string;
  hotReadUntil?: string | null;
  sourceCount: number;
  sources: Array<{ id: string; publisher: string; url: string; kind?: string; title?: string }>;
};
export async function getBeat(teamId: string) {
  return (await request<{ briefings: MobileBriefing[] }>(`/api/content/huddle?team=${teamId}`))
    .briefings;
}
export async function getBeatStory(storyId: string, teamId: string) {
  return request<MobileBriefing>(
    `/api/content/huddle/${encodeURIComponent(storyId)}?team=${encodeURIComponent(teamId)}`,
  );
}
export type MobileFilmVideo = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  thumbnail: string;
  duration: string;
  publishedAt: string | null;
  channel: { id: string; name: string };
  youtubeUrl: string;
  channelUrl: string;
};
export async function getFilmRoom(teamId: string) {
  return request<{ videos: MobileFilmVideo[]; message?: string }>(`/api/film-room?team=${teamId}`);
}
export type MobileCrew = {
  id: string;
  name: string;
  teamAbbr: string;
  role: 'OWNER' | 'MEMBER';
  weeklyYards: number;
  rank: number;
  members: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    weeklyYards: number;
    lifetimeYards: number;
  }>;
  activity: Array<{
    id: string;
    type: string;
    href: string | null;
    message: string | null;
    metadata: { title?: string };
    createdAt: string;
    actorName: string | null;
  }>;
};
export async function getCrew() {
  return (await authJson<{ crew: MobileCrew | null }>('/api/crew')).crew;
}
export async function createCrew(name: string, teamAbbr: string) {
  return authJson('/api/crew', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, teamAbbr }),
  });
}
export async function createCrewInvite(
  channel: 'EMAIL' | 'SMS' | 'SHARE_LINK',
  recipient?: string,
) {
  return authJson<{ invite: { inviteUrl: string; delivery: { state: string } } }>(
    '/api/crew/invites',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, recipient }),
    },
  );
}
export async function shareToCrew(input: {
  contentType: string;
  contentId: string;
  href: string;
  title: string;
  message?: string;
  recipientIds: string[];
}) {
  return authJson('/api/crew/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
export type CrewShareRecipient = { id: string; displayName: string; avatarUrl: string | null };
export async function getCrewShareRecipients() {
  return authJson<{ crew: { id: string; name: string } | null; recipients: CrewShareRecipient[] }>(
    '/api/crew/share',
  );
}
export type UserProfile = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string | null;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
};
export async function getUserProfile() {
  return (await authJson<{ profile: UserProfile }>('/api/user/profile')).profile;
}
export async function updateUserProfile(input: Pick<UserProfile, 'displayName'>) {
  return (
    await authJson<{ profile: UserProfile }>('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  ).profile;
}
export type UserPreferences = {
  intensity: 'CASUAL' | 'LOCKED_IN' | 'SICKO';
  pushEnabled: boolean;
  advancedNotifications: Record<string, boolean>;
};
export async function getUserPreferences() {
  return (await authJson<{ preferences: UserPreferences }>('/api/user/preferences')).preferences;
}
export async function updateUserPreferences(input: Partial<UserPreferences>) {
  return authJson('/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
export type MerchProduct = {
  id: string;
  name: string;
  category: string;
  type: string;
  price: number;
  compareAtPrice?: number;
  colors: string[];
  sizes: string[];
  imageUrl?: string;
  badge?: string;
};
export async function getMerch() {
  return request<{ categories: string[]; products: MerchProduct[] }>('/api/mobile/merch');
}
export async function placeCommerceOrder(input: Record<string, unknown>) {
  return (
    await authJson<{ order: { id: string; orderNumber: string; totalCents: number } }>(
      '/api/commerce/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
  ).order;
}
export async function quoteCommerceOrder(input: Record<string, unknown>) {
  return (
    await authJson<{
      quote: {
        subtotalCents: number;
        discountCents: number;
        shippingCents: number | null;
        taxCents: number | null;
        totalCents: number;
        promoCode: string | null;
      };
    }>('/api/commerce/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  ).quote;
}
export async function getCommerceOrders() {
  return (await authJson<{ orders: any[] }>('/api/commerce/orders')).orders;
}
export async function getCommerceOrder(orderId: string) {
  return (await authJson<{ order: any }>(`/api/commerce/orders/${orderId}`)).order;
}
export type PlayerResult = {
  id: string;
  name: string;
  position: string;
  teamAbbr: string;
  headshotUrl: string | null;
};
export type SearchData = {
  stories: Array<{
    id: string;
    headline: string;
    status: string;
    teamId: string;
    updatedAt: string;
    source: string | null;
    story: Story;
  }>;
  players: PlayerResult[];
};
export async function searchDD(query: string, teamId: string) {
  return request<SearchData>(`/api/mobile/search?q=${encodeURIComponent(query)}&team=${teamId}`);
}
export type FrontOfficeData = {
  team: { abbr: string; name: string; logoUrl: string; colors: [string, string] };
  updatedAt: string;
  cap: null | { totalCap: number | null; usedCap: number | null; availableCap: number | null };
  roster: Array<{
    id: string;
    name: string;
    position: string;
    age: number | null;
    status: string;
    headshotUrl: string | null;
    capHit: number | null;
    years: number | null;
  }>;
  transactions: Array<{
    id: string;
    headline: string;
    summary: string;
    status: string;
    occurredAt: string;
    source: string | null;
    story: Story;
  }>;
  availability: { depthChart: boolean; injuries: boolean };
};
export async function getFrontOffice(teamId: string) {
  return request<FrontOfficeData>(`/api/mobile/front-office?team=${teamId}`);
}
export type PlayerDetail = {
  player: {
    id: string;
    name: string;
    position: string;
    teamAbbr: string;
    age: number | null;
    height: string | null;
    weight: number | null;
    headshotUrl: string | null;
    rating: number;
    stats: Record<string, number>;
  };
  contract: null | {
    contractStatus: string | null;
    capHit: number | null;
    averagePerYear: number | null;
    guaranteed: number | null;
    years: number | null;
    contractEndYear: number | null;
  };
  stories: Array<{
    id: string;
    headline: string;
    summary: string;
    status: string;
    updatedAt: string;
  }>;
};
export async function getPlayer(playerId: string) {
  return request<PlayerDetail>(`/api/mobile/players/${encodeURIComponent(playerId)}`);
}
