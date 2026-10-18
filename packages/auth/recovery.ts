/** Shared by DOM and React Native forms. Tokens remain in memory only. */
export function recoveryLink(reset: unknown, verify: unknown) {
  const token = (value: unknown) =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{20,256}$/.test(value) ? value : null;
  const resetToken = token(reset),
    verifyToken = token(verify);
  return resetToken
    ? { mode: 'new-password' as const, token: resetToken }
    : verifyToken
      ? { mode: 'verify' as const, token: verifyToken }
      : null;
}
export function passwordError(password: string, confirmation: string) {
  return password.length < 10 || password.length > 256
    ? 'Use a password between 10 and 256 characters.'
    : password !== confirmation
      ? 'Passwords do not match.'
      : null;
}
