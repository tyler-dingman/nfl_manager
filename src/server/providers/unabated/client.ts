import { z } from 'zod';
import {
  generationSchema,
  oddsSchema,
  leagueSchema,
  sourceSchema,
  betTypeSchema,
  periodSchema,
  peopleSchema,
  teamsSchema,
  deepLinkSchema,
} from './types';
const BASE = 'https://data.unabated.com';
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// All callers in a process share the odds gate. Run only one ingestion scheduler per key;
// the audit command also takes a PostgreSQL advisory lock to exclude concurrent runs.
const oddsGates = new Map<string, { tail: Promise<void>; next: number }>();
export class UnabatedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'UnabatedError';
  }
}
export class UnabatedClient {
  readonly usage = { requests: 0, oddsRequests: 0, retries: 0 };
  constructor(
    private readonly options: {
      apiKey?: string;
      fetcher?: typeof fetch;
      wait?: typeof sleep;
      now?: () => number;
      maxRequests?: number;
    } = {},
  ) {}
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: { body?: unknown; direct?: boolean; noRetry?: boolean } = {},
  ): Promise<T> {
    const key = this.options.apiKey ?? process.env.UNABATED_API_KEY;
    if (!key) throw new UnabatedError('UNABATED_API_KEY is not configured.');
    const configuredBase = process.env.UNABATED_API_BASE_URL;
    if (configuredBase && configuredBase !== BASE)
      throw new UnabatedError('UNABATED_API_BASE_URL must be https://data.unabated.com.');
    const fetcher = this.options.fetcher ?? fetch;
    const wait = this.options.wait ?? sleep;
    const now = this.options.now ?? Date.now;
    const odds = /\/odds(?:\?|$)/.test(path);
    const run = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.usage.requests >= (this.options.maxRequests ?? 24))
          throw new UnabatedError('Unabated run request limit reached.');
        if (odds) {
          const gate = oddsGates.get(key)!;
          await wait(Math.max(0, gate.next - now()));
          gate.next = now() + 5000;
          this.usage.oddsRequests++;
        }
        this.usage.requests++;
        let response: Response;
        try {
          response = await fetcher(`${BASE}${path}`, {
            method: options.body ? 'POST' : 'GET',
            headers: {
              'X-Api-Key': key,
              Accept: 'application/json',
              ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(options.body ? { body: JSON.stringify(options.body) } : {}),
            signal: AbortSignal.timeout(20_000),
            redirect: 'error',
            cache: 'no-store',
          });
        } catch {
          // Never surface upstream URLs/headers or retry a possibly accepted generation POST.
          if (options.body || options.noRetry || attempt === 2)
            throw new UnabatedError('Unabated request failed or timed out.');
          this.usage.retries++;
          await wait(1000 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          if (
            !options.body &&
            !options.noRetry &&
            [429, 500, 502, 503, 504].includes(response.status) &&
            attempt < 2
          ) {
            const header = response.headers.get('Retry-After');
            const retry =
              header == null
                ? 0
                : /^\d+(\.\d+)?$/.test(header)
                  ? Number(header) * 1000
                  : Date.parse(header) - now();
            if (Number.isFinite(retry) && retry > 60_000)
              throw new UnabatedError(
                'Unabated retry window exceeds run deadline; retry later.',
                response.status,
              );
            this.usage.retries++;
            await wait(Math.max(1000 * 2 ** attempt, Number.isFinite(retry) ? retry : 0));
            continue;
          }
          throw new UnabatedError(
            `Unabated HTTP ${response.status}${response.status === 403 ? ': account tier or data scope denied' : ''}.`,
            response.status,
          );
        }
        let raw: unknown;
        try {
          raw = await response.json();
        } catch {
          throw new UnabatedError('Unabated returned invalid JSON.');
        }
        if (!options.direct) {
          const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(raw);
          if (!envelope.success)
            throw new UnabatedError(
              `Unabated ${path.split('?')[0]} response did not confirm success.`,
            );
          raw = envelope.data.data;
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) throw new UnabatedError('Unabated response failed schema validation.');
        return parsed.data;
      }
      throw new UnabatedError('Unabated retries exhausted.');
    };
    if (!odds) return run();
    const gate = oddsGates.get(key) ?? { tail: Promise.resolve(), next: 0 };
    oddsGates.set(key, gate);
    const pending = gate.tail.then(run).finally(() => {
      gate.next = now() + 5000;
    });
    gate.tail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }
  generateSlip(text: string) {
    return this.request('/api/v1/bet/generate', generationSchema, {
      direct: true,
      noRetry: true,
      body: { type: 'text', generateMobileLinks: false, content: { text } },
    });
  }
  slipStatus(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UnabatedError('Invalid generation ID.');
    return this.request(`/api/v1/bet/status/${id}`, generationSchema, {
      direct: true,
      noRetry: true,
    });
  }
  leagues() {
    return this.request('/league', leagueSchema);
  }
  betTypes() {
    return this.request('/bettype', betTypeSchema);
  }
  periods() {
    return this.request('/period-type/nfl', periodSchema);
  }
  sources() {
    return this.request('/market/nfl/props/sources', sourceSchema);
  }
  people() {
    return this.request('/market/nfl/props/people', peopleSchema);
  }
  teams() {
    return this.request('/market/nfl/props/teams', teamsSchema);
  }
  odds() {
    return this.request('/market/nfl/props/odds', oddsSchema);
  }
  deepLink(ids: number[], points: (number | null)[], state?: string) {
    if (
      !ids.length ||
      ids.length > 20 ||
      ids.length !== points.length ||
      ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      points.some((p) => p != null && !Number.isFinite(p))
    )
      throw new UnabatedError('Deep link requires 1–20 exact market-line IDs and matching points.');
    const query = new URLSearchParams({
      ids: ids.join(','),
      points: points.map((p) => p ?? '_').join(','),
    });
    if (state) query.set('state', state);
    return this.request(`/deeplink?${query}`, deepLinkSchema);
  }
}
