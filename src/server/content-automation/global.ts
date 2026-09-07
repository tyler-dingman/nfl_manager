export const DEFAULT_GLOBAL_GENERATION_LIMIT_PER_RUN = 10;
export const DEFAULT_GLOBAL_GENERATION_LIMIT_PER_DAY = 320;

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function globalAutomationConfig(env: Record<string, string | undefined> = process.env) {
  return {
    enabled: env.CONTENT_AUTOMATION_GLOBAL_ENABLED === 'true',
    maxGeneratedPerRun: positiveInteger(
      env.CONTENT_AUTOMATION_MAX_GENERATED_PER_RUN,
      DEFAULT_GLOBAL_GENERATION_LIMIT_PER_RUN,
    ),
    maxGeneratedPerDay: positiveInteger(
      env.CONTENT_AUTOMATION_MAX_GENERATED_PER_DAY,
      DEFAULT_GLOBAL_GENERATION_LIMIT_PER_DAY,
    ),
  };
}

export function globalGenerationStopReason(input: {
  enabled: boolean;
  generatedToday: number;
  maxGeneratedPerDay: number;
}) {
  if (!input.enabled) return 'Global content automation is disabled';
  if (input.generatedToday >= input.maxGeneratedPerDay)
    return `Global daily generation limit reached (${input.maxGeneratedPerDay})`;
  return null;
}
