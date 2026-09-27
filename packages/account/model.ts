export const ACCOUNT_PREFERENCES = [
  {
    key: 'emailEnabled',
    label: 'Email Notifications',
    description: 'Receive account and content updates.',
  },
  {
    key: 'pushEnabled',
    label: 'Push Notifications',
    description: 'Updates on your registered devices.',
  },
  {
    key: 'showAroundLeague',
    label: 'Around the League',
    description: 'Include stories beyond your favorite team.',
  },
  {
    key: 'autoplayVideo',
    label: 'Autoplay Videos',
    description: 'Play videos automatically while browsing.',
  },
] as const;
export type AccountData = {
  points: number | null;
  rank: number | null;
  crew: string | null;
  preferences: Record<string, boolean> | null;
  identities: { id: string; provider: string; providerEmail?: string | null }[] | null;
  providers: Record<string, boolean>;
};
export type AccountRequest = (url: string, init?: RequestInit) => Promise<Response>;
export async function loadAccountData(
  request: AccountRequest,
  userId: string,
): Promise<AccountData> {
  const paths = [
    '/api/trivia/stats',
    '/api/trivia/leaderboard?scope=GLOBAL&period=ALL_TIME',
    '/api/crew',
    '/api/user/preferences',
    '/api/auth/identities',
    '/api/auth/config',
  ];
  const responses = await Promise.all(
    paths.map(async (path) => {
      try {
        const r = await request(path);
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    }),
  );
  const [trivia, leaderboard, crew, prefs, identities, config] = responses;
  return {
    points: trivia?.stats?.lifetimePoints ?? null,
    rank: leaderboard?.rows?.find((r: { userId: string }) => r.userId === userId)?.rank ?? null,
    crew: crew?.crew?.name ?? null,
    preferences: prefs?.preferences ?? null,
    identities: identities?.identities ?? null,
    providers: config?.providers ?? {},
  };
}
export async function accountMutation(
  request: AccountRequest,
  path: string,
  method: string,
  input?: unknown,
) {
  const r = await request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Unable to save changes. Please try again.');
  return body;
}
