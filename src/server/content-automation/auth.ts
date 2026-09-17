import { timingSafeEqual } from 'node:crypto';

export function equalSecret(actual: string | null, expected?: string) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function automationAuthError(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env,
): { status: 401 | 503; code: string; error: string } | null {
  const current = env.CONTENT_AUTOMATION_SECRET;
  // A missing or malformed primary credential must never enable access.
  if (!current || current !== current.trim() || /\s/.test(current)) {
    return {
      status: 503,
      code: 'automation-not-configured',
      error: 'Automation authentication is not configured',
    };
  }
  const previous = env.CONTENT_AUTOMATION_PREVIOUS_SECRET;
  const candidates = [current, previous].filter((value): value is string =>
    Boolean(value && !/\s/.test(value)),
  );
  if (!candidates.some((secret) => equalSecret(authorization, `Bearer ${secret}`))) {
    return { status: 401, code: 'automation-unauthorized', error: 'Unauthorized' };
  }
  return null;
}
