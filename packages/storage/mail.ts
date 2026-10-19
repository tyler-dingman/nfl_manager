import { Storage, utf8, decode, digest } from './core';
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  unsubscribeUrl?: string;
  expiresAt?: number;
}
async function key(secret: string) {
  if (secret.length < 32) throw Error('Mail encryption key must be at least 32 characters');
  return crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', utf8.encode(secret)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}
type Envelope =
  | { schema: 2; iv: string; cipher: string }
  | { schema: 1; iv: number[]; cipher: number[] };
const base64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (x) => String.fromCharCode(x)).join(''));
const unbase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export async function sealBytes(bytes: Uint8Array, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await key(secret),
      bytes as BufferSource,
    );
  return { schema: 2 as const, iv: base64(iv), cipher: base64(new Uint8Array(cipher)) };
}
export async function unsealBytes(value: Envelope, secret: string) {
  if (value.schema !== 1 && value.schema !== 2) throw Error('Unknown encrypted envelope');
  const iv = value.schema === 1 ? new Uint8Array(value.iv) : unbase64(value.iv),
    cipher = value.schema === 1 ? new Uint8Array(value.cipher) : unbase64(value.cipher);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(secret), cipher),
  );
}
export async function seal(message: unknown, secret: string) {
  return sealBytes(utf8.encode(JSON.stringify(message)), secret);
}
export async function unseal<T>(value: Envelope, secret: string): Promise<T> {
  return JSON.parse(decode.decode(await unsealBytes(value, secret)));
}
export interface EmailProvider {
  name: string;
  dailyLimit: number;
  monthlyLimit: number;
  idempotencyMs: number;
  send(message: EmailMessage, id: string): Promise<{ id: string }>;
}
/** Concrete Resend adapter. No SDK, no secondary provider or paid fallback. Enrollment
 * and real deliveries must be verified separately. Tests inject a non-network fetcher. */
export class EmailRejection extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`Email provider HTTP ${status}`);
  }
}
export class ResendEmailProvider implements EmailProvider {
  name = 'resend';
  dailyLimit = 100;
  monthlyLimit = 3000;
  idempotencyMs = 86400000;
  constructor(
    readonly apiKey: string,
    readonly from: string,
    readonly fetcher: typeof fetch = fetch,
  ) {}
  async send(message: EmailMessage, id: string) {
    const response = await this.fetcher('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': await digest(utf8.encode(id)),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text:
          message.text +
          (message.unsubscribeUrl ? `\n\nUnsubscribe: ${message.unsubscribeUrl}` : ''),
        ...(message.unsubscribeUrl
          ? {
              headers: {
                'List-Unsubscribe': `<${message.unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
      }),
    });
    if (response.status === 429) {
      const value = response.headers.get('retry-after') ?? '60';
      const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
      throw new EmailRejection(
        429,
        Math.min(86400000, Math.max(1000, Number.isFinite(delay) ? delay : 60000)),
      );
    }
    if ([400, 401, 403, 404, 422].includes(response.status))
      throw new EmailRejection(response.status, null);
    if (!response.ok) throw Error(`Email provider HTTP ${response.status}`);
    const body = (await response.json()) as { id?: string };
    if (!body.id) throw Error('Email provider acknowledgement missing');
    return { id: body.id };
  }
}
export class MailQueue {
  constructor(
    readonly s: Storage,
    readonly secret: string,
  ) {}
  async stage(userId: string, purpose: string, dedupe: string, message: EmailMessage) {
    const [prior] = await this.s.rows('SELECT id FROM app_mail WHERE dedupe_key=?', [dedupe]);
    if (prior) return null;
    const objectHash = await this.s.put(await seal(message, this.secret));
    return this.s.statement(
      "INSERT INTO app_mail(id,user_id,purpose,dedupe_key,object_hash,status,next_at) VALUES(?,?,?,?,?,'READY',?) ON CONFLICT(dedupe_key) DO NOTHING",
      [crypto.randomUUID(), userId, purpose, dedupe, objectHash, Date.now()],
    );
  }
  async enqueue(userId: string, purpose: string, dedupe: string, message: EmailMessage) {
    const statement = await this.stage(userId, purpose, dedupe, message);
    if (statement) await this.s.batch([statement]);
  }
  async process(provider: EmailProvider, now = Date.now(), limit = 3) {
    const date = new Date(now).toISOString(),
      day = `mail:${provider.name}:${date.slice(0, 10)}`,
      month = `mail:${provider.name}:${date.slice(0, 7)}`;
    // A terminated sender may already have delivered. Never silently retry it.
    await this.s.batch([
      this.s.statement(
        "UPDATE app_mail SET status='UNCERTAIN',last_error='Sender interrupted; reconcile provider idempotency record' WHERE status='SENDING' AND next_at<?",
        [now - 60000],
      ),
    ]);
    const rows = await this.s.rows<any>(
      "SELECT * FROM app_mail WHERE status='READY' AND next_at<=? ORDER BY CASE WHEN purpose='TRANSACTIONAL' THEN 0 ELSE 1 END,next_at,id LIMIT ?",
      [now, Math.min(Math.max(limit, 1), 3)],
    );
    let sent = 0,
      deferred = 0;
    for (const row of rows) {
      const message = await unseal<EmailMessage>(
        await this.s.get<any>(row.object_hash),
        this.secret,
      );
      if (message.expiresAt && message.expiresAt <= now) {
        await this.s.batch([
          this.s.statement(
            "UPDATE app_mail SET status='FAILED',last_error='Message expired; request a new recovery link' WHERE id=? AND status='READY'",
            [row.id],
          ),
        ]);
        continue;
      }
      if (row.purpose === 'EDITORIAL') {
        const [subscription] = await this.s.rows<any>(
          "SELECT b.enabled FROM app_subscriptions b JOIN app_users u ON u.id=b.user_id JOIN app_settings s ON s.user_id=u.id WHERE b.user_id=? AND b.topic=? AND u.status='ACTIVE' AND u.email_verified=1 AND coalesce(json_extract(s.preferences_json,'$.emailEnabled'),1)=1",
          [row.user_id, 'THREE_AND_OUT'],
        );
        if (!subscription?.enabled) {
          await this.s.batch([
            this.s.statement(
              "UPDATE app_mail SET status='SUPPRESSED',last_error='Unsubscribed before sending' WHERE id=? AND status='READY'",
              [row.id],
            ),
          ]);
          continue;
        }
      }
      // Reserve a 30% margin and 10 daily transactional sends. Reserved attempts count
      // even on lost acknowledgements; a provider cannot be overspent through retries.
      const daily = Math.floor(provider.dailyLimit * 0.7) - (row.purpose === 'EDITORIAL' ? 10 : 0),
        monthly = Math.floor(provider.monthlyLimit * 0.7),
        nonce = crypto.randomUUID();
      if (daily < 1 || monthly < 1) {
        deferred++;
        continue;
      }
      try {
        await this.s.batch([
          this.s.statement(
            "UPDATE app_mail SET status='SENDING',lease_nonce=?,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,?),next_at=? WHERE id=? AND status='READY'",
            [nonce, now, now, row.id],
          ),
          this.s.guard(nonce),
          this.s.statement(
            'INSERT INTO app_limits(bucket,used) VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<?',
            [day, daily],
          ),
          this.s.guard(nonce + 'd'),
          this.s.statement(
            'INSERT INTO app_limits(bucket,used) VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<?',
            [month, monthly],
          ),
          this.s.guard(nonce + 'm'),
          this.s.unguard(nonce),
          this.s.unguard(nonce + 'd'),
          this.s.unguard(nonce + 'm'),
        ]);
      } catch {
        deferred++;
        continue;
      }
      try {
        const result = await provider.send(message, row.dedupe_key);
        await this.s.batch([
          this.s.statement(
            "UPDATE app_mail SET status='SENT',provider_id=?,last_error=NULL WHERE id=? AND lease_nonce=?",
            [result.id, row.id, nonce],
          ),
        ]);
        sent++;
      } catch (error) {
        const rejected = error instanceof EmailRejection;
        const retry = rejected && error.retryAfterMs !== null && row.attempts < 4;
        await this.s.batch([
          this.s.statement(
            'UPDATE app_mail SET status=?,next_at=?,last_error=? WHERE id=? AND lease_nonce=?',
            [
              retry ? 'READY' : rejected ? 'FAILED' : 'UNCERTAIN',
              retry ? now + error.retryAfterMs! : now,
              rejected ? error.message : 'Delivery not confirmed; reconcile before retry',
              row.id,
              nonce,
            ],
          ),
        ]);
      }
    }
    return { sent, deferred, considered: rows.length };
  }
  async subscribe(userId: string, enabled: boolean) {
    await this.s.batch([
      this.s.statement(
        'INSERT INTO app_subscriptions(user_id,topic,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,topic) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at',
        [userId, 'THREE_AND_OUT', enabled ? 1 : 0, Date.now()],
      ),
    ]);
  }
  async enqueueDailyBriefing(hash: string, baseUrl: string, afterUser = '', limit = 3) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 3) throw Error('Mail fanout limit');
    const publication = await this.s.get<{
      approved: boolean;
      id: string;
      team: string;
      date: string;
      subject: string;
      text: string;
    }>(hash);
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
      throw Error('Editorial email links require HTTPS');
    if (
      !publication.approved ||
      !publication.id ||
      !/^\d{4}-\d{2}-\d{2}$/.test(publication.date) ||
      !publication.team ||
      !publication.subject ||
      !publication.text ||
      publication.text.length > 50000
    )
      throw Error('A stored approved publication is required');
    const users = await this.s.rows<{ id: string; primary_email: string }>(
      "SELECT u.id,u.primary_email FROM app_users u JOIN app_subscriptions b ON b.user_id=u.id AND b.topic='THREE_AND_OUT' AND b.enabled=1 JOIN app_settings s ON s.user_id=u.id WHERE u.id>? AND u.email_verified=1 AND u.status='ACTIVE' AND json_extract(s.preferences_json,'$.preferredTeamId')=? AND coalesce(json_extract(s.preferences_json,'$.emailEnabled'),1)=1 ORDER BY u.id LIMIT ?",
      [afterUser, publication.team, limit],
    );
    for (const user of users) {
      const unsubscribe = new URL('/api/email/unsubscribe', url);
      unsubscribe.searchParams.set(
        'token',
        await this.unsubscribeToken(user.id, Date.now() + 366 * 86400000),
      );
      await this.enqueue(
        user.id,
        'EDITORIAL',
        `three-out:${publication.date}:${publication.id}:${user.id}`,
        {
          to: user.primary_email,
          subject: publication.subject,
          text: publication.text,
          unsubscribeUrl: unsubscribe.href,
          expiresAt: Date.now() + 86400000,
        },
      );
    }
    return {
      considered: users.length,
      nextCursor: users.length === limit ? users.at(-1)!.id : null,
      delivery: 'QUEUED_NOT_SENT',
    };
  }
  async unsubscribeToken(userId: string, expiresAt: number) {
    const data = JSON.stringify({ userId, expiresAt, topic: 'THREE_AND_OUT' }),
      body = Array.from(utf8.encode(data), (v) => v.toString(16).padStart(2, '0')).join('');
    const hmac = await crypto.subtle.importKey(
      'raw',
      utf8.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Array.from(
      new Uint8Array(await crypto.subtle.sign('HMAC', hmac, utf8.encode(body))),
      (x) => x.toString(16).padStart(2, '0'),
    ).join('');
    return `${body}.${signature}`;
  }
  async unsubscribe(token: string, now = Date.now()) {
    const [body, signature, ...extra] = token.split('.');
    if (
      extra.length ||
      !body ||
      body.length > 2048 ||
      !/^(?:[a-f0-9]{2})+$/.test(body) ||
      !/^[a-f0-9]{64}$/.test(signature ?? '')
    )
      throw Error('Invalid unsubscribe token');
    const hmac = await crypto.subtle.importKey(
      'raw',
      utf8.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = new Uint8Array(signature.match(/../g)!.map((x) => parseInt(x, 16)));
    if (!(await crypto.subtle.verify('HMAC', hmac, sig, utf8.encode(body))))
      throw Error('Invalid unsubscribe signature');
    const data = JSON.parse(
      decode.decode(new Uint8Array(body.match(/../g)!.map((x) => parseInt(x, 16)))),
    );
    if (
      data.topic !== 'THREE_AND_OUT' ||
      !Number.isSafeInteger(data.expiresAt) ||
      data.expiresAt < now
    )
      throw Error('Expired unsubscribe link');
    await this.subscribe(data.userId, false);
  }
}
