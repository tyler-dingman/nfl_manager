export function notificationMatchesTeamScope(
  notificationTeam: string | null | undefined,
  activeTeam: string | null | undefined,
) {
  if (!activeTeam || !notificationTeam) return true;
  return notificationTeam.toUpperCase() === activeTeam.toUpperCase();
}
