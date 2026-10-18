import * as pg from './repository-postgres';
import { D1UserRepository } from '../../../packages/storage/user';
import { applicationBackend, applicationStorage } from '../persistence/bindings';
function dispatch<K extends keyof typeof pg>(name: K): (typeof pg)[K] {
  return (async (...args: unknown[]) => {
    if (applicationBackend() === 'postgres') return (pg[name] as Function)(...args);
    const repo = new D1UserRepository(applicationStorage()),
      method = (repo as unknown as Record<string, Function>)[name];
    if (!method) throw Error(`D1 user operation is not migrated: ${name}`);
    return method.apply(repo, args);
  }) as (typeof pg)[K];
}
export const ensureUserSettings = dispatch('ensureUserSettings');
export const getProfile = dispatch('getProfile');
export const updateProfile = dispatch('updateProfile');
export const getPreferences = dispatch('getPreferences');
export const updatePreferences = dispatch('updatePreferences');
export const listTeamFollows = dispatch('listTeamFollows');
export const followTeam = dispatch('followTeam');
export const setPrimaryTeam = dispatch('setPrimaryTeam');
export const unfollowTeam = dispatch('unfollowTeam');
export const getOnboarding = dispatch('getOnboarding');
export const updateOnboarding = dispatch('updateOnboarding');
export const requestEmailChange = dispatch('requestEmailChange');
export const confirmEmailChange = dispatch('confirmEmailChange');
