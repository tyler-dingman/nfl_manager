export function requiresPkce(authorizationCode?: string | null, codeVerifier?: string | null) {
  return !authorizationCode || Boolean(codeVerifier);
}