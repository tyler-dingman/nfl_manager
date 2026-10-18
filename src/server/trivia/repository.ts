import * as pg from './repository-postgres';
import { D1DailyTrivia } from '../../../packages/storage/trivia';
import { applicationBackend, applicationStorage } from '../persistence/bindings';
function dispatch<K extends keyof typeof pg>(name: K): (typeof pg)[K] {
  return (async (...args: unknown[]) => {
    if (applicationBackend() === 'postgres') return (pg[name] as Function)(...args);
    const repo = new D1DailyTrivia(applicationStorage(), process.env.NODE_ENV === 'production');
    const method = (repo as unknown as Record<string, Function>)[name];
    if (!method) throw Error(`D1 trivia operation is not migrated: ${name}`);
    return method.apply(repo, args);
  }) as (typeof pg)[K];
}
export const listActiveQuestions = dispatch('listActiveQuestions');
export const getDailyQuestion = dispatch('getDailyQuestion');
export const ensureDailyQuestion = dispatch('ensureDailyQuestion');
export const getDailyAnswer = dispatch('getDailyAnswer');
export const markDailyPresented = dispatch('markDailyPresented');
export const getDailyResponseTime = dispatch('getDailyResponseTime');
export const answerDailyQuestion = dispatch('answerDailyQuestion');
export const getMoveTheChainsAccount = dispatch('getMoveTheChainsAccount');
export const getTriviaStats = dispatch('getTriviaStats');
export const startTriviaGame = dispatch('startTriviaGame');
