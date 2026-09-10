import type {
  FranchiseGameState,
  FranchiseTeamState,
  GameSimulationResult,
  SimulatedPlayer,
  SimulatedPlayerStat,
  SimulatedTeamStats,
} from '@/types/front-office';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
const unit = (seed: string) => hashSeed(seed) / 4_294_967_295;
const integer = (seed: string, min: number, max: number) =>
  Math.floor(min + unit(seed) * (max - min + 1));
const position = (value: string) => value.toUpperCase().replace(/[^A-Z]/g, '');
const isPosition = (player: SimulatedPlayer, values: string[]) =>
  values.some((value) => position(player.position).includes(value));

function fallbackPlayer(teamAbbr: string, role: string, index = 1): SimulatedPlayer {
  return {
    id: `${teamAbbr.toLowerCase()}-${role.toLowerCase()}-${index}`,
    name: `${teamAbbr} ${role}${index > 1 ? ` ${index}` : ''}`,
    teamAbbr,
    position: role,
    rating: 70,
    headshotUrl: null,
  };
}

function ranked(players: SimulatedPlayer[], values: string[], teamAbbr: string, fallback: string) {
  const matches = players
    .filter((player) => player.teamAbbr === teamAbbr && isPosition(player, values))
    .sort((left, right) => right.rating - left.rating || left.name.localeCompare(right.name));
  return matches.length ? matches : [fallbackPlayer(teamAbbr, fallback)];
}

function scoringAllocation(score: number, seed: string) {
  const maxTouchdowns = Math.min(6, Math.floor(score / 7));
  const offensiveTD = Math.max(
    0,
    maxTouchdowns - (score >= 28 && unit(`${seed}:return`) < 0.18 ? 1 : 0),
  );
  const passingTD = offensiveTD
    ? clamp(Math.round(offensiveTD * (0.48 + unit(`${seed}:pass-share`) * 0.35)), 0, offensiveTD)
    : 0;
  return { passingTD, rushingTD: offensiveTD - passingTD };
}

function makeTeamBoxScore(input: {
  team: FranchiseTeamState;
  opponent: FranchiseTeamState;
  score: number;
  opponentScore: number;
  players: SimulatedPlayer[];
  seed: string;
}) {
  const { team, opponent, score, opponentScore, players, seed } = input;
  const qbs = ranked(players, ['QB'], team.abbr, 'QB');
  const rbs = ranked(players, ['RB', 'HB'], team.abbr, 'RB');
  const receivers = [
    ...ranked(players, ['WR'], team.abbr, 'WR').slice(0, 3),
    ...ranked(players, ['TE'], team.abbr, 'TE').slice(0, 1),
    rbs[0],
  ].filter((player, index, list) => list.findIndex((item) => item.id === player.id) === index);
  const defenders = ranked(
    players,
    ['EDGE', 'DE', 'DT', 'DL', 'LB', 'OLB', 'ILB', 'CB', 'DB', 'S', 'FS', 'SS'],
    team.abbr,
    'EDGE',
  );
  const qb = qbs[0];
  const rb = rbs[0];
  const won = score > opponentScore;
  const ratingEdge = (team.overall - opponent.overall) * 1.4 + (qb.rating - 75) * 0.7;
  const passingYards = clamp(
    Math.round(205 + score * 2.4 + ratingEdge + (unit(`${seed}:pass-yards`) - 0.5) * 105),
    105,
    430,
  );
  const rushingYards = clamp(
    Math.round(
      88 + (won ? 22 : -5) + (rb.rating - 75) * 1.1 + (unit(`${seed}:rush-yards`) - 0.5) * 65,
    ),
    42,
    225,
  );
  const { passingTD, rushingTD } = scoringAllocation(score, seed);
  const interceptions = clamp(
    Math.round((1.35 - (qb.rating - 70) / 28) * unit(`${seed}:qb-int`) * 1.7),
    0,
    3,
  );
  const attempts = clamp(
    Math.round(27 + (opponentScore > score ? 7 : 1) + unit(`${seed}:attempts`) * 10),
    22,
    49,
  );
  const completions = clamp(
    Math.round(
      attempts *
        clamp(0.56 + (qb.rating - 70) / 125 + (unit(`${seed}:cmp`) - 0.5) * 0.1, 0.48, 0.76),
    ),
    1,
    attempts,
  );
  const stats: SimulatedPlayerStat[] = [
    {
      playerId: qb.id,
      playerName: qb.name,
      teamAbbr: team.abbr,
      position: qb.position,
      headshotUrl: qb.headshotUrl ?? null,
      completions,
      attempts,
      passingYards,
      passingTD,
      interceptions,
      performanceScore: passingYards / 12 + passingTD * 18 - interceptions * 10,
    },
  ];

  const receiverWeights = receivers.map(
    (player, index) => Math.max(8, player.rating - 50) * [1.35, 1.05, 0.75, 0.82, 0.48][index]!,
  );
  const weightTotal = receiverWeights.reduce((sum, value) => sum + value, 0);
  let remainingYards = passingYards;
  receivers.forEach((player, index) => {
    const last = index === receivers.length - 1;
    const receivingYards = last
      ? remainingYards
      : clamp(
          Math.round((passingYards * receiverWeights[index]!) / weightTotal),
          0,
          remainingYards,
        );
    const receivingTD =
      Math.floor(passingTD / receivers.length) + (index < passingTD % receivers.length ? 1 : 0);
    remainingYards -= receivingYards;
    const receptions = receivingYards
      ? clamp(Math.round(receivingYards / (9 + unit(`${seed}:rec:${player.id}`) * 7)), 1, 14)
      : 0;
    const isBack = player.id === rb.id;
    stats.push({
      playerId: player.id,
      playerName: player.name,
      teamAbbr: team.abbr,
      position: player.position,
      headshotUrl: player.headshotUrl ?? null,
      receptions,
      receivingYards,
      receivingTD,
      ...(isBack
        ? {
            carries: clamp(Math.round(13 + (won ? 5 : 0) + unit(`${seed}:carries`) * 7), 8, 27),
            rushingYards,
            rushingTD,
          }
        : {}),
      performanceScore:
        receivingYards / 3.5 + receivingTD * 18 + (isBack ? rushingYards / 4 + rushingTD * 18 : 0),
    });
  });

  const sacks = clamp(
    Math.round(1 + unit(`${seed}:sacks`) * 4 + (team.overall - opponent.overall) / 12),
    0,
    7,
  );
  let remainingSacks = sacks;
  const sackDefenders = defenders.slice(0, 4);
  sackDefenders.forEach((player, index) => {
    const playerSacks =
      index === sackDefenders.length - 1
        ? remainingSacks
        : index === 0
          ? Math.ceil(remainingSacks / 2)
          : remainingSacks > 0
            ? 1
            : 0;
    remainingSacks -= playerSacks;
    stats.push({
      playerId: player.id,
      playerName: player.name,
      teamAbbr: team.abbr,
      position: player.position,
      headshotUrl: player.headshotUrl ?? null,
      tackles: integer(`${seed}:tackles:${player.id}`, 3, 10),
      sacks: playerSacks,
      defensiveInterceptions: 0,
      forcedFumbles: playerSacks && unit(`${seed}:ff:${player.id}`) < 0.28 ? 1 : 0,
      performanceScore: playerSacks * 22 + integer(`${seed}:score-tkl:${player.id}`, 3, 10) * 1.4,
    });
  });

  const teamStats: SimulatedTeamStats = {
    passingYards,
    passingTD,
    interceptions,
    rushingYards,
    rushingTD,
    receivingYards: passingYards,
    receivingTD: passingTD,
    sacks,
    turnovers: interceptions,
  };
  return { stats, teamStats };
}

function addDefensiveInterceptions(
  stats: SimulatedPlayerStat[],
  teamAbbr: string,
  count: number,
  seed: string,
) {
  const defenders = stats.filter(
    (stat) => stat.teamAbbr === teamAbbr && stat.tackles !== undefined,
  );
  for (let index = 0; index < count; index += 1) {
    const defender = defenders[index % Math.max(1, defenders.length)];
    if (!defender) continue;
    defender.defensiveInterceptions = (defender.defensiveInterceptions ?? 0) + 1;
    defender.performanceScore += 25 + unit(`${seed}:def-int:${index}`) * 3;
  }
}

function selectTopPerformers(stats: SimulatedPlayerStat[], teamAbbr: string) {
  const team = stats.filter((stat) => stat.teamAbbr === teamAbbr);
  const offense = team.filter(
    (stat) =>
      stat.passingYards !== undefined ||
      stat.rushingYards !== undefined ||
      stat.receivingYards !== undefined,
  );
  const defense = team.filter((stat) => stat.tackles !== undefined);
  const chosen: SimulatedPlayerStat[] = [];
  const add = (candidate?: SimulatedPlayerStat) => {
    if (candidate && !chosen.some((item) => item.playerId === candidate.playerId))
      chosen.push(candidate);
  };
  add(offense.sort((a, b) => b.performanceScore - a.performanceScore)[0]);
  add(offense.sort((a, b) => b.performanceScore - a.performanceScore)[1]);
  add(defense.sort((a, b) => b.performanceScore - a.performanceScore)[0]);
  team.sort((a, b) => b.performanceScore - a.performanceScore).forEach((stat) => add(stat));
  return chosen.slice(0, 3).map((stat) => stat.playerId);
}

function recapCopy(
  teamAbbr: string,
  opponent: string,
  score: number,
  opponentScore: number,
  top: SimulatedPlayerStat,
) {
  const margin = Math.abs(score - opponentScore);
  const won = score > opponentScore;
  const tied = score === opponentScore;
  const headline = tied
    ? `${teamAbbr} SETTLES FOR A TIE`
    : won
      ? margin >= 14
        ? `${teamAbbr} TAKES CARE OF BUSINESS`
        : `${teamAbbr} GETS IT DONE`
      : margin >= 14
        ? `${opponent} HANDS ${teamAbbr} A LOSS`
        : `${teamAbbr} COMES UP SHORT`;
  const performance = top.passingYards
    ? `a ${top.passingYards}-yard passing performance from ${top.playerName}`
    : top.receivingYards
      ? `${top.playerName}'s ${top.receivingYards} receiving yards`
      : `${top.playerName}'s impact on defense`;
  return {
    headline,
    summary: `${teamAbbr} ${tied ? 'finished level with' : won ? 'came out on top against' : 'fell to'} ${opponent} behind ${performance}.`,
  };
}

export function createGameSimulationResult(input: {
  game: FranchiseGameState;
  teams: Record<string, FranchiseTeamState>;
  players: SimulatedPlayer[];
  seed: string;
}): GameSimulationResult {
  const { game, teams, players, seed } = input;
  if (game.homeScore === null || game.awayScore === null) throw new Error('Game must be final.');
  const home = makeTeamBoxScore({
    team: teams[game.homeTeam],
    opponent: teams[game.awayTeam],
    score: game.homeScore,
    opponentScore: game.awayScore,
    players,
    seed: `${seed}:${game.id}:home-box`,
  });
  const away = makeTeamBoxScore({
    team: teams[game.awayTeam],
    opponent: teams[game.homeTeam],
    score: game.awayScore,
    opponentScore: game.homeScore,
    players,
    seed: `${seed}:${game.id}:away-box`,
  });
  const playerStats = [...home.stats, ...away.stats];
  addDefensiveInterceptions(
    playerStats,
    game.homeTeam,
    away.teamStats.interceptions,
    `${seed}:${game.id}:home`,
  );
  addDefensiveInterceptions(
    playerStats,
    game.awayTeam,
    home.teamStats.interceptions,
    `${seed}:${game.id}:away`,
  );
  const topPerformers = {
    [game.homeTeam]: selectTopPerformers(playerStats, game.homeTeam),
    [game.awayTeam]: selectTopPerformers(playerStats, game.awayTeam),
  };
  const homeTop = playerStats.find((stat) => stat.playerId === topPerformers[game.homeTeam][0])!;
  const awayTop = playerStats.find((stat) => stat.playerId === topPerformers[game.awayTeam][0])!;
  const homeCopy = recapCopy(game.homeTeam, game.awayTeam, game.homeScore, game.awayScore, homeTop);
  const awayCopy = recapCopy(game.awayTeam, game.homeTeam, game.awayScore, game.homeScore, awayTop);
  return {
    gameId: game.id,
    week: game.week,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    winner: game.winner,
    overtime: Boolean(game.overtime),
    teamStats: { [game.homeTeam]: home.teamStats, [game.awayTeam]: away.teamStats },
    playerStats,
    topPerformers,
    recapHeadline: { [game.homeTeam]: homeCopy.headline, [game.awayTeam]: awayCopy.headline },
    recapSummary: { [game.homeTeam]: homeCopy.summary, [game.awayTeam]: awayCopy.summary },
    simulatedAt: new Date(0).toISOString(),
  };
}
