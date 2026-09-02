export function isAllowedAdminUser(userId: string | null | undefined, configuredIds: string) {
  if (!userId) return false;
  return configuredIds
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(userId);
}