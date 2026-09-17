const BASE_URL = 'https://api.sportsgameodds.com/v2';
const DEFAULT_MONTHLY_OBJECT_CEILING = 1_000;
const DEFAULT_RUN_REQUEST_CEILING = 2;
// This only affects the next explicitly run import; loading Parlay Lab never calls the provider.
const SUPPORTED_BOOKMAKER_IDS = ['fanduel', 'draftkings', 'betmgm', 'caesars'] as const;
const requestedBookmakers = (
  process.env.SPORTSGAMEODDS_BOOKMAKER_IDS ?? SUPPORTED_BOOKMAKER_IDS.join(',')
)
  .split(',')
  .map((id) => id.trim().toLowerCase());
// Keep provider requests aligned with the books presented in Parlay Lab, even
// if a stale environment value still contains a previously supported book.
const BOOKMAKER_IDS = SUPPORTED_BOOKMAKER_IDS.filter((id) => requestedBookmakers.includes(id)).join(
  ',',
);

export type SportsGameOddsBookLine = {
  odds?: string | number;
  spread?: string | number;
  overUnder?: string | number;
  available?: boolean;
  deeplink?: string;
  oddID?: string;
  [key: string]: unknown;
};

export type SportsGameOddsOdd = {
  oddID: string;
  statID?: string;
  statEntityID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  marketName?: string;
  byBookmaker?: Record<string, SportsGameOddsBookLine & { altLines?: SportsGameOddsBookLine[] }>;
};

export type SportsGameOddsEvent = {
  eventID: string;
  leagueID?: string;
  status?: Record<string, unknown>;
  teams?: Record<string, unknown>;
  players?: Record<string, unknown>;
  odds?: Record<string, SportsGameOddsOdd>;
  [key: string]: unknown;
};

export class SportsGameOddsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SportsGameOddsError';
  }
}

type Page = {
  success?: boolean;
  data?: SportsGameOddsEvent[];
  error?: string;
  nextCursor?: string;
};
type UsagePayload = {
  success?: boolean;
  error?: string;
  data?: {
    tier?: string;
    rateLimits?: Record<string, Record<string, string | number>>;
  };
};

const numericLimit = (value: string | number | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export class SportsGameOddsClient {
  private dataRequests = 0;

  constructor(
    private readonly apiKey = process.env.SPORTSGAMEODDS_API_KEY,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async getUsage() {
    if (!this.apiKey) throw new SportsGameOddsError('SPORTSGAMEODDS_API_KEY is not configured.');
    const response = await this.fetcher(`${BASE_URL}/account/usage`, {
      headers: { 'x-api-key': this.apiKey },
    });
    if (!response.ok) {
      throw new SportsGameOddsError(
        `Unable to verify SportsGameOdds usage (${response.status}); import stopped safely.`,
        response.status,
      );
    }
    const payload = (await response.json()) as UsagePayload;
    if (payload.success === false || !payload.data) {
      throw new SportsGameOddsError(
        payload.error ?? 'Unable to verify SportsGameOdds usage; import stopped safely.',
      );
    }
    return payload.data;
  }

  private async enforceUsageGuard() {
    const configuredMonthlyCeiling = Number(
      process.env.SPORTSGAMEODDS_MONTHLY_OBJECT_CEILING ?? DEFAULT_MONTHLY_OBJECT_CEILING,
    );
    const monthlyCeiling = Number.isFinite(configuredMonthlyCeiling)
      ? Math.min(configuredMonthlyCeiling, DEFAULT_MONTHLY_OBJECT_CEILING)
      : DEFAULT_MONTHLY_OBJECT_CEILING;
    const configuredRunCeiling = Number(
      process.env.SPORTSGAMEODDS_MAX_REQUESTS_PER_RUN ?? DEFAULT_RUN_REQUEST_CEILING,
    );
    const runCeiling = Number.isFinite(configuredRunCeiling)
      ? Math.min(configuredRunCeiling, DEFAULT_RUN_REQUEST_CEILING)
      : DEFAULT_RUN_REQUEST_CEILING;

    if (this.dataRequests >= runCeiling) {
      throw new SportsGameOddsError(
        `Local SportsGameOdds safety limit reached (${runCeiling} data requests in this run).`,
      );
    }

    const usage = await this.getUsage();
    const monthly = usage.rateLimits?.['per-month'] ?? {};
    const used = numericLimit(monthly['current-entities'] ?? monthly.currentEntities);
    const providerMaximum = numericLimit(monthly['max-entities'] ?? monthly.maxEntities);
    if (used === null) {
      throw new SportsGameOddsError(
        'SportsGameOdds did not report monthly object usage; import stopped safely.',
      );
    }
    if (used >= monthlyCeiling) {
      throw new SportsGameOddsError(
        `Local monthly safety ceiling reached (${used}/${monthlyCeiling} objects). No odds request was made.`,
      );
    }
    console.info(
      '[sportsGameOdds] usage',
      `${used}/${providerMaximum ?? 'unknown'} monthly objects; local ceiling ${monthlyCeiling}`,
    );
    this.dataRequests += 1;
  }

  private async request(params: URLSearchParams): Promise<Page> {
    if (!this.apiKey) throw new SportsGameOddsError('SPORTSGAMEODDS_API_KEY is not configured.');
    await this.enforceUsageGuard();
    const url = `${BASE_URL}/events?${params.toString()}`;
    console.info('[sportsGameOdds] GET /events', Object.fromEntries(params));
    const response = await this.fetcher(url, { headers: { 'x-api-key': this.apiKey } });
    const usage = response.headers.get('x-ratelimit-remaining');
    if (usage) console.info('[sportsGameOdds] quota remaining', usage);
    if (!response.ok) {
      throw new SportsGameOddsError(
        response.status === 429
          ? 'SportsGameOdds quota exceeded.'
          : `SportsGameOdds request failed (${response.status}).`,
        response.status,
      );
    }
    const payload = (await response.json()) as Page;
    if (payload.success === false)
      throw new SportsGameOddsError(payload.error ?? 'SportsGameOdds returned an error.');
    return payload;
  }

  async getEvent(eventId: string) {
    const params = new URLSearchParams({
      eventID: eventId,
      bookmakerID: BOOKMAKER_IDS,
      includeAltLines: 'true',
      includeOpposingOdds: 'true',
      includeOpenCloseOdds: 'true',
    });
    return (await this.request(params)).data ?? [];
  }

  async getNflEvents(input: { startsAfter: string; startsBefore: string }) {
    const params = new URLSearchParams({
      leagueID: 'NFL',
      type: 'match',
      started: 'false',
      oddsPresent: 'true',
      bookmakerID: BOOKMAKER_IDS,
      includeAltLines: 'true',
      includeOpposingOdds: 'true',
      includeOpenCloseOdds: 'true',
      startsAfter: input.startsAfter,
      startsBefore: input.startsBefore,
      limit: '100',
    });
    const events: SportsGameOddsEvent[] = [];
    let cursor: string | undefined;
    do {
      if (cursor) params.set('cursor', cursor);
      const page = await this.request(params);
      events.push(...(page.data ?? []));
      cursor = page.nextCursor;
    } while (cursor);
    return events;
  }
}
