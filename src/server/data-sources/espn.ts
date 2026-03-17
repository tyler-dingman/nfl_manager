const ESPN_TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';

type EspnTeam = {
  id: string;
  displayName: string;
  shortDisplayName?: string;
  abbreviation?: string;
};

type EspnRosterAthlete = {
  id: string;
  fullName: string;
  displayName?: string;
  jersey?: string;
  position?: { abbreviation?: string; displayName?: string };
};

export type TeamSourceRecord = {
  id: string;
  name: string;
  abbreviation: string;
};

export type PlayerSourceRecord = {
  id: string;
  teamId: string;
  fullName: string;
  position: string;
  jerseyNumber: string | null;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
};

export const fetchTeams = async (): Promise<TeamSourceRecord[]> => {
  const payload = await fetchJson<{
    sports?: Array<{ leagues?: Array<{ teams?: Array<{ team?: EspnTeam }> }> }>;
  }>(ESPN_TEAMS_URL);
  const teams = payload.sports?.[0]?.leagues?.[0]?.teams ?? [];

  return teams
    .map((entry) => entry.team)
    .filter((team): team is EspnTeam => Boolean(team?.id && team.abbreviation && team.displayName))
    .map((team) => ({
      id: team.id,
      name: team.displayName,
      abbreviation: team.abbreviation ?? team.shortDisplayName ?? team.displayName.slice(0, 3),
    }));
};

export const fetchRoster = async (teamId: string): Promise<PlayerSourceRecord[]> => {
  const payload = await fetchJson<{ athletes?: Array<{ items?: EspnRosterAthlete[] }> }>(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`,
  );

  return (payload.athletes ?? []).flatMap((group) =>
    (group.items ?? [])
      .filter((athlete) => athlete.id && athlete.fullName)
      .map((athlete) => ({
        id: athlete.id,
        teamId,
        fullName: athlete.fullName,
        position: athlete.position?.abbreviation ?? athlete.position?.displayName ?? 'UNK',
        jerseyNumber: athlete.jersey ?? null,
      })),
  );
};
