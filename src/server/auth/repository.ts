import * as pg from './postgres-repository';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { MailQueue } from '../../../packages/storage/mail';
import { digest, utf8 } from '../../../packages/storage/core';
import { applicationEnvironment } from '../persistence/bindings';
import { applicationBackend, applicationStorage } from '../persistence/bindings';
export const toPublicUser = pg.toPublicUser;
function dispatch<K extends keyof typeof pg>(name: K): (typeof pg)[K] {
  return (async (...args: unknown[]) => {
    if (applicationBackend() === 'postgres') return (pg[name] as Function)(...args);
    const repo = new D1AuthRepository(applicationStorage());
    if (
      name === 'createOneTimeToken' &&
      ['EMAIL_VERIFICATION', 'PASSWORD_RESET'].includes(String(args[1]))
    ) {
      const [userId, type, token, minutes] = args as [string, string, string, number],
        env = applicationEnvironment(),
        user = await repo.findUserById(userId);
      if (!user?.primary_email || !env.AUTH_BASE_URL || !env.AUTH_JWT_SECRET)
        throw Error('Recovery mail configuration is incomplete');
      const url = new URL('/login', env.AUTH_BASE_URL);
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
        throw Error('Recovery links require HTTPS');
      url.searchParams.set(type === 'PASSWORD_RESET' ? 'resetToken' : 'verifyToken', token);
      if (!env.APP_MAIL_ENCRYPTION_KEY) throw Error('Mail encryption key is not configured');
      const queue = new MailQueue(repo.s, env.APP_MAIL_ENCRYPTION_KEY),
        hash = await digest(utf8.encode(token));
      const mail = await queue.stage(userId, 'TRANSACTIONAL', `${type}:${hash}`, {
        to: user.primary_email,
        subject:
          type === 'PASSWORD_RESET'
            ? 'Reset your Down & Distance password'
            : 'Verify your Down & Distance email',
        text: `${type === 'PASSWORD_RESET' ? 'Reset your password' : 'Verify your email'}: ${url.href}`,
        expiresAt: Date.now() + minutes * 60000,
      });
      await repo.s.batch([
        ...repo.tokenStatements(userId, type, hash, minutes),
        ...(mail ? [mail] : []),
      ]);
      return;
    }
    const method = (repo as unknown as Record<string, Function>)[name];
    if (!method) throw Error(`D1 auth operation is not migrated: ${name}`);
    return method.apply(repo, args);
  }) as (typeof pg)[K];
}
export const findUserByEmail = dispatch('findUserByEmail');
export const findUserById = dispatch('findUserById');
export const updateUserProfile = dispatch('updateUserProfile');
export const createEmailUser = dispatch('createEmailUser');
export const getCredential = dispatch('getCredential');
export const recordLogin = dispatch('recordLogin');
export const recordFailedLogin = dispatch('recordFailedLogin');
export const resolveSocialUser = dispatch('resolveSocialUser');
export const linkSocialIdentity = dispatch('linkSocialIdentity');
export const unlinkIdentity = dispatch('unlinkIdentity');
export const createSession = dispatch('createSession');
export const findSessionByToken = dispatch('findSessionByToken');
export const findActiveSessionById = dispatch('findActiveSessionById');
export const rotateSession = dispatch('rotateSession');
export const revokeSessionToken = dispatch('revokeSessionToken');
export const revokeSessionById = dispatch('revokeSessionById');
export const revokeAllSessions = dispatch('revokeAllSessions');
export const listSessions = dispatch('listSessions');
export const listIdentities = dispatch('listIdentities');
export const createOneTimeToken = dispatch('createOneTimeToken');
export const consumeOneTimeToken = dispatch('consumeOneTimeToken');
export const verifyUserEmail = dispatch('verifyUserEmail');
export const changePassword = dispatch('changePassword');
