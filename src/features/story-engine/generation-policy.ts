import type { ContentAiProvider } from '@/features/content/ai-provider';

export function maxNewAiStoriesPerTeamPerDay(
  env: Record<string, string | undefined> = process.env,
) {
  const raw = env.MAX_NEW_AI_STORIES_PER_TEAM_PER_DAY ?? '10';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1)
    throw new Error('MAX_NEW_AI_STORIES_PER_TEAM_PER_DAY must be a positive integer.');
  return value;
}

export function mayGenerateNewStory(input: {
  provider: ContentAiProvider;
  publishedToday: number;
  maximum?: number;
  existingStory?: boolean;
}) {
  const maximum = input.maximum ?? maxNewAiStoriesPerTeamPerDay();
  if (input.existingStory) return true;
  return input.provider !== 'ollama' || input.publishedToday < maximum;
}
