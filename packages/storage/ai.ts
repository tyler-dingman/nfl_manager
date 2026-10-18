import { Storage, digest, utf8 } from './core';
export class InferenceQuotaError extends Error {}
export interface InferenceProvider {
  model: string;
  maximumNeurons(input: string, maxOutputTokens: number): number;
  generate(input: string, maxOutputTokens: number): Promise<{ text: string }>;
}
/** Provider-independent cache key includes model, prompt policy and source version.
 * Reserve worst-case cost before inference. Missing quota returns an explicit error,
 * never invented summaries or stale answers under a new source version. */
export class SharedInference {
  constructor(
    readonly s: Storage,
    readonly dailyBudget = 7000,
  ) {
    if (!Number.isSafeInteger(dailyBudget) || dailyBudget < 1 || dailyBudget > 7000)
      throw Error('Free inference budget must be 1–7000 neurons');
  }
  async generate(
    provider: InferenceProvider,
    input: {
      team: string;
      sourceVersion: string;
      policy: string;
      prompt: string;
      maxOutputTokens: number;
    },
    now = Date.now(),
  ) {
    const key = await digest(utf8.encode(JSON.stringify({ model: provider.model, ...input }))),
      [cached] = await this.s.rows<any>('SELECT * FROM app_ai_cache WHERE cache_key=?', [key]);
    if (cached?.object_hash && cached.expires_at > now)
      return { text: await this.s.get<string>(cached.object_hash), cached: true };
    const bound = Math.ceil(provider.maximumNeurons(input.prompt, input.maxOutputTokens));
    if (!Number.isSafeInteger(bound) || bound < 1 || bound > this.dailyBudget)
      throw new InferenceQuotaError('Inference reservation exceeds configured free budget');
    const nonce = crypto.randomUUID(),
      bucket = `ai:${new Date(now).toISOString().slice(0, 10)}`;
    try {
      await this.s.batch([
        this.s.statement(
          'INSERT INTO app_ai_cache(cache_key,source_version,expires_at,lease_nonce,lease_until) VALUES(?,?,0,?,?) ON CONFLICT(cache_key) DO UPDATE SET lease_nonce=excluded.lease_nonce,lease_until=excluded.lease_until WHERE lease_until<?',
          [key, input.sourceVersion, nonce, now + 60000, now],
        ),
        this.s.guard(nonce),
        this.s.statement(
          'INSERT INTO app_limits(bucket,used) VALUES(?,?) ON CONFLICT(bucket) DO UPDATE SET used=used+excluded.used WHERE used+excluded.used<=?',
          [bucket, bound, this.dailyBudget],
        ),
        this.s.guard(nonce + 'quota'),
        this.s.unguard(nonce),
        this.s.unguard(nonce + 'quota'),
      ]);
    } catch {
      throw new InferenceQuotaError(
        'Free inference budget unavailable or identical generation already pending',
      );
    }
    try {
      const result = await provider.generate(input.prompt, input.maxOutputTokens);
      if (!result.text.trim()) throw Error('Provider returned no grounded content');
      const hash = await this.s.put(result.text);
      await this.s.batch([
        this.s.statement(
          'UPDATE app_ai_cache SET object_hash=?,expires_at=?,lease_until=0 WHERE cache_key=? AND lease_nonce=?',
          [hash, now + 86400000, key, nonce],
        ),
      ]);
      return { text: result.text, cached: false };
    } catch (error) {
      await this.s.batch([
        this.s.statement(
          'UPDATE app_ai_cache SET lease_until=0 WHERE cache_key=? AND lease_nonce=?',
          [key, nonce],
        ),
      ]);
      throw error;
    }
  }
}
export class WorkersInference implements InferenceProvider {
  model = '@cf/qwen/qwen3-30b-a3b-fp8';
  constructor(readonly binding: { run(model: string, input: unknown): Promise<unknown> }) {}
  maximumNeurons(input: string, max: number) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 4096)
      throw Error('Invalid output token limit');
    return Math.ceil(
      ((new TextEncoder().encode(input).length + 256) * 4625) / 1e6 + (max * 30475) / 1e6,
    );
  }
  async generate(prompt: string, maxOutputTokens: number) {
    const result = (await this.binding.run(this.model, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
    })) as { response?: string };
    if (!result.response) throw Error('Workers AI response unavailable');
    return { text: result.response };
  }
}
export async function lexicalSearch(s: Storage, query: string, team: string, limit = 20) {
  const tokens = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 20) ?? [];
  if (!tokens.length) return [];
  const escaped = tokens.map((t) => `"${t.replaceAll('"', '""')}"`).join(' AND ');
  return s.rows(
    'SELECT id,title,source_id,source_url,snippet(app_search,3,?,?,?,24) AS excerpt FROM app_search WHERE app_search MATCH ? AND team_id=? ORDER BY bm25(app_search) LIMIT ?',
    ['[', ']', '…', escaped, team, Math.min(Math.max(limit, 1), 20)],
  );
}
