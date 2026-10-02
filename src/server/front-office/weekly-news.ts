import type { FranchiseSimulationState } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';
import type { NewFrontOfficeEvent } from './events-repository';

const hash = (text: string) => {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
};
/** Editorial selection from completed simulation facts. No roster changes or invented injuries. */
export function weeklyNews(input: {
  saveId: string;
  teamAbbr: string;
  previous: FranchiseSimulationState;
  current: FranchiseSimulationState;
  roster?: PlayerRowDTO[];
}) {
  const { saveId, teamAbbr, previous, current, roster = [] } = input;
  const old = new Set(
    [...previous.games, ...(previous.playoffs?.games ?? [])]
      .filter((g) => g.played)
      .map((g) => g.id),
  );
  const fresh = [...current.games, ...(current.playoffs?.games ?? [])].filter(
    (g) => g.played && g.seasonType === 'REG' && !old.has(g.id),
  );
  const output: NewFrontOfficeEvent[] = [];
  for (const week of [...new Set(fresh.map((g) => g.week))]) {
    const games = fresh.filter((g) => g.week === week);
    const candidates: NewFrontOfficeEvent[] = [];
    const add = (
      key: string,
      team: string,
      category: string,
      headline: string,
      summary: string,
      score: number,
      playerId: string | null = null,
    ) =>
      candidates.push({
        id: `foe:${saveId}:${current.season}:${week}:${key}`,
        dedupeKey: key,
        saveId,
        type: category === 'RUMOR' ? 'trade_rumor' : 'league_transaction',
        priority: 'normal',
        headline,
        summary,
        teamAbbr: team,
        relatedTeamAbbr: null,
        playerId,
        prospectId: null,
        tradeOfferId: null,
        simulationSeason: current.season,
        simulationWeek: week,
        simulationPhase: current.phase,
        actionUrl: null,
        expiresAt: null,
        metadata: {
          newsCategory: category,
          importanceScore: score,
          origin: 'SIMULATION',
          sourceEventId: key,
          teamIds: [team],
          isBreaking: false,
        },
      });
    for (const game of games) {
      for (const p of game.result?.playerStats ?? []) {
        if (p.playerName.startsWith(`${p.teamAbbr} `)) continue;
        let detail = '';
        if ((p.passingTD ?? 0) >= 3)
          detail = `throws ${p.passingTD} touchdowns and ${p.passingYards ?? 0} yards`;
        else if ((p.receivingYards ?? 0) >= 100)
          detail = `breaks out with ${p.receivingYards} receiving yards`;
        else if ((p.rushingYards ?? 0) >= 100)
          detail = `powers the ground game with ${p.rushingYards} yards`;
        else if ((p.sacks ?? 0) >= 2) detail = `records ${p.sacks} sacks`;
        if (detail)
          add(
            `performance:${game.id}:${p.playerId}`,
            p.teamAbbr,
            'PERFORMANCE',
            `${p.playerName} ${detail}`,
            `Week ${week}: ${p.teamAbbr}'s ${p.position} delivered a standout performance. The numbers come from the completed game in this franchise.`,
            80 + p.performanceScore / 100,
            p.playerId,
          );
      }
    }
    const through = current.games.filter((g) => g.played && g.week <= week);
    const records = Object.values(current.teams).map((t) => {
      const played = through.filter((g) => [g.homeTeam, g.awayTeam].includes(t.abbr));
      const wins = played.filter((g) => g.winner === t.abbr).length;
      return {
        ...t,
        played,
        wins,
        losses: played.filter((g) => g.winner && g.winner !== t.abbr).length,
      };
    });
    for (const t of records) {
      if (!games.some((g) => [g.homeTeam, g.awayTeam].includes(t.abbr))) continue;
      const recent = t.played.slice(-3);
      const scoring = recent.reduce(
        (n, g) => n + (g.homeTeam === t.abbr ? (g.homeScore ?? 0) : (g.awayScore ?? 0)),
        0,
      );
      const allowed = recent.reduce(
        (n, g) => n + (g.homeTeam === t.abbr ? (g.awayScore ?? 0) : (g.homeScore ?? 0)),
        0,
      );
      if (recent.length >= 2 && scoring / recent.length >= 25)
        add(
          `offense:${week}:${t.abbr}`,
          t.abbr,
          'PERFORMANCE',
          `${t.abbr} offense averages ${(scoring / recent.length).toFixed(1)} points over ${recent.length} games`,
          `The offense has scored ${scoring} points during that stretch. ${t.abbr} now stands ${t.wins}–${t.losses}.`,
          60,
        );
      if (recent.length >= 2 && allowed / recent.length <= 22)
        add(
          `defense:${week}:${t.abbr}`,
          t.abbr,
          'PERFORMANCE',
          `${t.abbr} defense allows ${(allowed / recent.length).toFixed(1)} points per game over its last ${recent.length}`,
          `Opponents have scored ${allowed} points in that span. Defensive consistency is shaping ${t.abbr}'s season.`,
          59,
        );
      if (t.played.length >= 5 && t.wins / t.played.length < 0.35 && scoring / recent.length < 20)
        add(
          `coaching:${week}:${t.abbr}`,
          t.abbr,
          'COACHING',
          `Scoring slump puts ${t.abbr}'s offensive approach under scrutiny`,
          `${t.abbr} is ${t.wins}–${t.losses} and averaging ${(scoring / recent.length).toFixed(1)} points over its last ${recent.length} games. A D&D analysis of the simulated team's struggles, not a reported coaching change.`,
          65,
        );
      if (week >= 7 && week <= 9 && t.wins < t.losses) {
        const eligible = roster
          .filter(
            (p) =>
              (p.teamAbbr ?? p.currentTeamAbbr) === t.abbr &&
              (p.age ?? 0) >= 28 &&
              p.contractYearsRemaining <= 1,
          )
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        const p =
          eligible[hash(`${current.seed}:${week}:${t.abbr}`) % Math.max(1, eligible.length)];
        if (p)
          add(
            `market:${week}:${p.id}`,
            t.abbr,
            'RUMOR',
            `${p.firstName} ${p.lastName} is a name to watch before the deadline`,
            `${t.abbr} sits ${t.wins}–${t.losses}; the ${p.age}-year-old ${p.position} is in the final year of his deal. League Buzz market analysis: a plausible selling candidate, not a completed trade or confirmed offer.`,
            85,
            p.id,
          );
      }
      if (week >= 10) {
        const rivals = records
          .filter((r) => r.division === t.division && r.conference === t.conference)
          .sort((a, b) => b.wins - a.wins);
        if (rivals[0]?.abbr === t.abbr && rivals[1] && t.wins - rivals[1].wins <= 1)
          add(
            `race:${week}:${t.conference}:${t.division}`,
            t.abbr,
            'PLAYOFF RACE',
            `${t.conference} ${t.division} race: ${t.abbr} and ${rivals[1].abbr} separated by ${t.wins - rivals[1].wins} wins`,
            `${t.abbr} (${t.wins}–${t.losses}) and ${rivals[1].abbr} (${rivals[1].wins}–${rivals[1].losses}) remain close in the division standings.`,
            75,
          );
      }
    }
    const rank = (a: NewFrontOfficeEvent, b: NewFrontOfficeEvent) =>
      Number(b.metadata.importanceScore) +
        (hash(`${current.seed}:${week}:${b.id}:mix`) % 35) -
        (Number(a.metadata.importanceScore) + (hash(`${current.seed}:${week}:${a.id}:mix`) % 35)) ||
      hash(`${current.seed}:${week}:${a.id}`) - hash(`${current.seed}:${week}:${b.id}`);
    const league = candidates.filter((e) => e.teamAbbr !== teamAbbr).sort(rank);
    // Give supported market/standings context a slot so statistical leaders don't crowd it out.
    const context = league.filter((e) => e.metadata.newsCategory !== 'PERFORMANCE');
    const preferred = context.sort(
      (a, b) =>
        (b.metadata.newsCategory === 'RUMOR' ? 1 : 0) -
          (a.metadata.newsCategory === 'RUMOR' ? 1 : 0) || rank(a, b),
    );
    const contextSlots = preferred.slice(0, week === 9 ? 4 : 1);
    const selectedOrder = [
      ...contextSlots,
      ...league.filter((e) => !contextSlots.some((c) => c.id === e.id)),
    ];
    const budget = week === 9 ? 7 : 2 + (hash(`${current.seed}:editorial:${week}`) % 2);
    // Spread editorial coverage across teams instead of repeating one matchup.
    const used = new Set<string>();
    for (const e of selectedOrder) {
      if (used.has(e.teamAbbr!)) continue;
      output.push(e);
      used.add(e.teamAbbr!);
      if (used.size >= budget) break;
    }
    if (week % 2 === 1 || hash(`${current.seed}:team:${week}`) % 4 === 0) {
      const own = candidates.filter((e) => e.teamAbbr === teamAbbr).sort(rank)[0];
      if (own) output.push(own);
    }
  }
  return output;
}
