import { stageAuthToken } from './d1-mail';
import * as pg from './postgres-repository';
import { D1AuthRepository } from '../../../packages/storage/auth';
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
        user = await repo.findUserById(userId);
      if (!user?.primary_email) throw Error('Recovery user is unavailable');
      await repo.s.batch(
        await stageAuthToken(repo, userId, user.primary_email, type, token, minutes),
      );
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
