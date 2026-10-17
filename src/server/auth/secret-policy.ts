export function assertAuthSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.trim() !== secret || secret.length < 32)
    throw new Error(
      'AUTH_JWT_SECRET must contain at least 32 characters without surrounding whitespace.',
    );
}
