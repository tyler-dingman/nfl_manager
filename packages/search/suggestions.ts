export const AI_QUICK_PROMPTS = [
  'Catch me up today',
  'Injury updates',
  'Latest roster moves',
] as const;
export type SearchSuggestionContext = {
  teamName: string;
  nextGame: boolean;
  previousGame: boolean;
  injuries: boolean;
  recentNews: boolean;
  todayNews: boolean;
};
/** Questions are offered only for data the answer engine currently has. */
export function contextualSearchQuestions(context: SearchSuggestionContext): string[] {
  if (!context.teamName.trim()) return [];
  return [
    context.nextGame && `When do the ${context.teamName} play next?`,
    context.injuries && `What's the latest on ${context.teamName} injuries?`,
    context.previousGame && `How did the ${context.teamName} do last game?`,
    context.todayNews
      ? `What are the biggest ${context.teamName} stories today?`
      : context.recentNews && `What's the latest ${context.teamName} news?`,
  ].filter((question): question is string => Boolean(question));
}
