import { jwtVerify, SignJWT } from 'jose';
import { secureToken, hashPassword, verifyPassword } from './crypto';
import { requireAuthConfig } from './config';
import {
  changePassword,
  consumeOneTimeToken,
  createEmailUser,
  createOneTimeToken,
  createSession,
  findSessionByToken,
  findActiveSessionById,
  findUserByEmail,
  findUserById,
  getCredential,
  recordFailedLogin,
  recordLogin,
  revokeAllSessions,
  toPublicUser,
  verifyUserEmail,
} from './repository';

const genericLoginError = new Error('The email or password is incorrect.');

export async function signupWithEmail(input: {
  email: string;
  password: string;
  displayName?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (await findUserByEmail(email)) throw new Error('Unable to create account with those details.');
  const user = await createEmailUser({
    email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
  });
  const verificationToken = secureToken();
  await createOneTimeToken(user.id, 'EMAIL_VERIFICATION', verificationToken, 24 * 60);
  return {
    user: toPublicUser(user),
    verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
  };
}

export async function loginWithEmail(emailInput: string, password: string) {
  const user = await findUserByEmail(emailInput.trim().toLowerCase());
  if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') throw genericLoginError;
  const credential = await getCredential(user.id);
  if (!credential || (credential.locked_until && credential.locked_until > new Date()))
    throw genericLoginError;
  if (!(await verifyPassword(credential.password_hash, password))) {
    await recordFailedLogin(user.id);
    throw genericLoginError;
  }
  await recordLogin(user.id);
  return toPublicUser({ ...user, last_login_at: new Date() });
}

export async function issueSession(
  userId: string,
  metadata: { deviceId?: string | null; ip?: string | null; userAgent?: string | null },
) {
  const refreshToken = secureToken(48);
  const session = await createSession({ userId, token: refreshToken, ...metadata });
  const accessToken = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('down-distance')
    .setAudience('down-distance-api')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(requireAuthConfig().AUTH_JWT_SECRET));
  return { refreshToken, accessToken, expiresAt: session.expiresAt };
}

export async function userFromSessionToken(token?: string | null) {
  if (!token) return null;
  const session = await findSessionByToken(token);
  if (!session || session.revoked_at || session.expires_at <= new Date()) return null;
  const user = await findUserById(session.user_id);
  return user?.status === 'ACTIVE' || user?.status === 'PENDING' ? toPublicUser(user) : null;
}

export async function userFromAccessToken(token?: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(requireAuthConfig().AUTH_JWT_SECRET),
      { issuer: 'down-distance', audience: 'down-distance-api' },
    );
    if (!payload.sub || typeof payload.sid !== 'string') return null;
    if (!(await findActiveSessionById(payload.sid, payload.sub))) return null;
    const user = await findUserById(payload.sub);
    return user?.status === 'ACTIVE' || user?.status === 'PENDING' ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user) return {};
  const resetToken = secureToken();
  await createOneTimeToken(user.id, 'PASSWORD_RESET', resetToken, 30);
  return { resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined };
}

export async function resetPassword(token: string, password: string) {
  const consumed = await consumeOneTimeToken(token, 'PASSWORD_RESET');
  if (!consumed) throw new Error('This password reset link is invalid or expired.');
  await changePassword(consumed.user_id, await hashPassword(password));
  await revokeAllSessions(consumed.user_id);
}

export async function confirmEmail(token: string) {
  const consumed = await consumeOneTimeToken(token, 'EMAIL_VERIFICATION');
  if (!consumed) throw new Error('This verification link is invalid or expired.');
  await verifyUserEmail(consumed.user_id);
}

export async function updatePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
) {
  const credential = await getCredential(userId);
  if (!credential || !(await verifyPassword(credential.password_hash, currentPassword))) {
    throw new Error('The current password is incorrect.');
  }
  await changePassword(userId, await hashPassword(nextPassword));
  await revokeAllSessions(userId);
}
