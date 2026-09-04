export const CREW_DAILY_INVITE_LIMIT = 20;
export const CREW_INVITE_RESEND_COOLDOWN_MINUTES = 10;

export function normalizeCrewInviteRecipient(channel: 'EMAIL' | 'SMS', value: string) {
  if (channel === 'EMAIL') {
    const normalized = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email.');
    return normalized;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('Enter a valid phone number.');
  return `+${digits}`;
}

export function canAcceptCrewInvite(input: {
  status: string;
  expiresAt: Date;
  inviteeUserId?: string | null;
  userId: string;
}) {
  if (input.status !== 'PENDING') return { ok: false, reason: 'Invite is no longer available.' };
  if (input.expiresAt <= new Date()) return { ok: false, reason: 'Invite has expired.' };
  if (input.inviteeUserId && input.inviteeUserId !== input.userId)
    return { ok: false, reason: 'This invite belongs to another user.' };
  return { ok: true, reason: 'Invite may be accepted.' };
}

export const canManageCrew = (role: string) => role === 'OWNER';
export const shouldNotifyCrewShare = (
  actorUserId: string,
  recipientUserId: string,
  enabled = true,
) => enabled && actorUserId !== recipientUserId;
