export const FAN_TEAM_STORAGE_KEY = 'down-distance-fan-team';

export function readFanTeamPreference() {
  try {
    return window.localStorage.getItem(FAN_TEAM_STORAGE_KEY)?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

export async function readCanonicalFanTeamPreference() {
  const localTeam = readFanTeamPreference();
  try {
    const response = await fetch('/api/user/home', { cache: 'no-store', credentials: 'include' });
    if (!response.ok) return localTeam;
    const body = (await response.json()) as {
      personalization?: { primaryTeam?: { teamId?: string | null } | null };
    };
    const serverTeam = body.personalization?.primaryTeam?.teamId?.toUpperCase() ?? null;
    if (serverTeam) window.localStorage.setItem(FAN_TEAM_STORAGE_KEY, serverTeam);
    return serverTeam ?? localTeam;
  } catch {
    return localTeam;
  }
}

export async function saveFanTeamPreference(teamAbbr: string) {
  const normalized = teamAbbr.toUpperCase();
  try {
    window.localStorage.setItem(FAN_TEAM_STORAGE_KEY, normalized);
  } catch {
    // The selected team still works for this visit when storage is unavailable.
  }
  try {
    await fetch('/api/user/team-follows/primary', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ teamId: normalized }),
    });
  } catch {
    // Anonymous and offline users still retain the local team selection.
  }
}

export function clearFanTeamPreference() {
  try {
    window.localStorage.removeItem(FAN_TEAM_STORAGE_KEY);
  } catch {
    // The current page can still return to the generic NFL view.
  }
}
