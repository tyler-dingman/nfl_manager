/** Explicit opt-in qualification policy. Never substitute a different AI provider. */
export function assertPaidInferenceAllowed(env: Record<string, string | undefined> = process.env) {
  const policy = env.INFRASTRUCTURE_COST_POLICY;
  if (policy && !['standard', 'zero-cost'].includes(policy))
    throw new Error('Unsupported INFRASTRUCTURE_COST_POLICY.');
  if (policy === 'zero-cost')
    throw new Error(
      'OpenAI inference requires paid infrastructure and is blocked by the zero-cost policy.',
    );
}
