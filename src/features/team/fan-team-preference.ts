export const FAN_TEAM_STORAGE_KEY = 'down-distance-fan-team';

export function readFanTeamPreference() {
  try {
    return window.localStorage.getItem(FAN_TEAM_STORAGE_KEY)?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

export function saveFanTeamPreference(teamAbbr: string) {
  try {
    window.localStorage.setItem(FAN_TEAM_STORAGE_KEY, teamAbbr.toUpperCase());
  } catch {
    // The selected team still works for this visit when storage is unavailable.
  }
}

export function clearFanTeamPreference() {
  try {
    window.localStorage.removeItem(FAN_TEAM_STORAGE_KEY);
  } catch {
    // The current page can still return to the generic NFL view.
  }
}
