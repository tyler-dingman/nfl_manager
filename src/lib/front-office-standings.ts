import type {
  FranchiseGameState,
  FranchiseSimulationState,
  FranchiseTeamState,
} from '@/types/front-office';

export type StandingsTeam = FranchiseTeamState & {
  winPercentage: number;
  pointDifferential: number;
};

export function buildStandingsSnapshot(
  state: FranchiseSimulationState,
  throughWeek: number,
): Record<string, StandingsTeam> {
  const teams = Object.fromEntries(
    Object.values(state.teams).map((team) => [
      team.abbr,
      {
        ...team,
        record: { wins: 0, losses: 0, ties: 0 },
        pointsFor: 0,
        pointsAgainst: 0,
        winPercentage: 0,
        pointDifferential: 0,
      },
    ]),
  ) as Record<string, StandingsTeam>;

  state.games
    .filter(
      (game) =>
        game.played &&
        game.seasonType === 'REG' &&
        game.week <= throughWeek &&
        game.homeScore !== null &&
        game.awayScore !== null,
    )
    .forEach((game) => {
      const home = teams[game.homeTeam];
      const away = teams[game.awayTeam];
      if (!home || !away || game.homeScore === null || game.awayScore === null) return;
      home.pointsFor += game.homeScore;
      home.pointsAgainst += game.awayScore;
      away.pointsFor += game.awayScore;
      away.pointsAgainst += game.homeScore;
      if (game.homeScore === game.awayScore) {
        home.record.ties += 1;
        away.record.ties += 1;
      } else if (game.homeScore > game.awayScore) {
        home.record.wins += 1;
        away.record.losses += 1;
      } else {
        away.record.wins += 1;
        home.record.losses += 1;
      }
    });

  Object.values(teams).forEach((team) => {
    const games = team.record.wins + team.record.losses + team.record.ties;
    team.winPercentage = games ? (team.record.wins + team.record.ties * 0.5) / games : 0;
    team.pointDifferential = team.pointsFor - team.pointsAgainst;
  });
  return teams;
}

export function rankStandings(teams: StandingsTeam[]) {
  return [...teams].sort(
    (a, b) =>
      b.winPercentage - a.winPercentage ||
      b.pointDifferential - a.pointDifferential ||
      b.pointsFor - a.pointsFor ||
      a.abbr.localeCompare(b.abbr),
  );
}

export function buildPlayoffPicture(teams: StandingsTeam[], conference: string) {
  const conferenceTeams = teams.filter((team) => team.conference === conference);
  const divisions = [...new Set(conferenceTeams.map((team) => team.division))];
  const divisionWinners = rankStandings(
    divisions.flatMap((division) =>
      rankStandings(conferenceTeams.filter((team) => team.division === division)).slice(0, 1),
    ),
  );
  const winnerAbbrs = new Set(divisionWinners.map((team) => team.abbr));
  const wildCards = rankStandings(
    conferenceTeams.filter((team) => !winnerAbbrs.has(team.abbr)),
  ).slice(0, 3);
  return [...divisionWinners, ...wildCards];
}

export function gamesForWeek(state: FranchiseSimulationState, week: number): FranchiseGameState[] {
  return state.games.filter(
    (game) => game.seasonType === 'REG' && game.week === week && game.played,
  );
}
