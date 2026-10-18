import * as pg from './content-repository-postgres';
import { D1UserRepository } from '../../../packages/storage/user';
import { applicationBackend, applicationStorage } from '../persistence/bindings';
export type {
  ContentType,
  ContentStateInput,
  CatchUpVisitState,
} from './content-repository-postgres';
function dispatch<K extends keyof typeof pg>(name: K): (typeof pg)[K] {
  return (async (...args: unknown[]) => {
    if (applicationBackend() === 'postgres') return (pg[name] as Function)(...args);
    const repo = new D1UserRepository(applicationStorage()),
      method = (repo as unknown as Record<string, Function>)[name];
    if (!method) throw Error(`D1 user operation is not migrated: ${name}`);
    return method.apply(repo, args);
  }) as (typeof pg)[K];
}
export const listContentState = dispatch('listContentState');
export const upsertContentState = dispatch('upsertContentState');
export const listSavedContent = dispatch('listSavedContent');
export const saveContent = dispatch('saveContent');
export const unsaveContent = dispatch('unsaveContent');
export const getTeamVisitState = dispatch('getTeamVisitState');
export const updateTeamVisitState = dispatch('updateTeamVisitState');
export const recordCatchUpVisit = dispatch('recordCatchUpVisit');
export const completeCatchUp = dispatch('completeCatchUp');
export const getPollVote = dispatch('getPollVote');
export const savePollVote = dispatch('savePollVote');
export const createPrediction = dispatch('createPrediction');
export const listPredictions = dispatch('listPredictions');
