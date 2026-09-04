import { createHash, randomUUID } from 'node:crypto';

import { authDb } from '@/server/auth/database';

export type SecurityAuditEvent =
  | 'SIGN_IN'
  | 'SIGN_IN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'EMAIL_CHANGED'
  | 'IDENTITY_LINKED'
  | 'IDENTITY_UNLINKED'
  | 'SESSION_REVOKED'
  | 'PHONE_ADDED'
  | 'PHONE_REMOVED'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'DEVICE_REGISTERED'
  | 'COMMERCE_REFUND_REQUESTED'
  | 'ACCOUNT_EXPORT_REQUESTED'
  | 'ACCOUNT_DELETED';

const hashIp = (ip?: string | null) =>
  ip ? createHash('sha256').update(ip).digest('hex').slice(0, 24) : null;

export async function recordSecurityEvent(
  userId: string | null,
  eventType: SecurityAuditEvent,
  input?: { ip?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> },
) {
  const metadata = input?.metadata ? JSON.parse(JSON.stringify(input.metadata)) : {};
  await authDb()`
    INSERT INTO security_audit_events (id, user_id, event_type, ip_hash, user_agent_family, metadata)
    VALUES (${randomUUID()}, ${userId}, ${eventType}, ${hashIp(input?.ip)}, ${input?.userAgent?.slice(0, 120) ?? null}, ${authDb().json(metadata)})`;
}
