import type { SaveState } from '@/server/api/store';
import { getTradableDraftPicksForTeam } from '@/server/api/store';
import type { FranchiseSimulationState } from '@/types/front-office';
import type { HeroPerson } from '../../../packages/front-office/hero-story';
import type { OffseasonHeroContext } from '../../../packages/front-office/hero-offseason';
import { heroStoryKey } from '../../../packages/front-office/hero-story';
import { TEAM_LIST } from '@/data/teams';
import type { PlayerRowDTO } from '@/types/player';
export const heroPerson = (p: PlayerRowDTO): HeroPerson => ({
  id: p.id,
  name: `${p.firstName} ${p.lastName}`.trim(),
  position: p.position,
  image: p.headshotUrl,
  rating: p.rating ?? p.maddenRating ?? p.baselineRating ?? undefined,
  age: p.age,
  years: p.contractYearsRemaining ?? p.contract?.yearsRemaining,
  team: p.teamAbbr ?? undefined,
  capHit: p.capHitValue ?? p.contract?.capHit,
  ask:
    (p.currentAskAnnualValue ?? p.freeAgentProfile?.expectedAnnualValue ?? p.expectedAnnualValue) !=
    null
      ? (p.currentAskAnnualValue ??
          p.freeAgentProfile?.expectedAnnualValue ??
          p.expectedAnnualValue)! / 1_000_000
      : undefined,
});
export function buildOffseasonHeroContext(
  store: SaveState,
  state: FranchiseSimulationState,
  team: string,
): OffseasonHeroContext {
  const key = heroStoryKey(state);
  state.heroPhaseEntries ??= {};
  state.heroPhaseEntries[key] ??= store.transactions.map((t) => t.id);
  const baseline = new Set(state.heroPhaseEntries[key]);
  const latest = store.transactions
    .filter((t) => !baseline.has(t.id) && (!t.toTeamAbbr || t.toTeamAbbr === team))
    .at(-1);
  const person =
    latest &&
    store.roster.find((p) => p.id === latest.playerId && p.status.toLowerCase() !== 'cut');
  const phaseAction =
    (state.phase === 'resign_cut' && latest?.type === 're-sign') ||
    (['free_agency', 'free_agency_open'].includes(state.phase) && latest?.type === 'signing');
  const contractYears = person?.contractYearsRemaining ?? person?.contract?.yearsRemaining;
  const apy = person?.contract?.apy ?? person?.salary;
  const pending: HeroPerson[] = store.expiringContracts
    .filter(
      (p) =>
        !store.offseason.resolvedPlayerIds.includes(p.id) &&
        !store.offseason.walkawayPlayerIds.includes(p.id) &&
        !store.roster.some(
          (r) =>
            r.id === p.id && (r.status.toLowerCase() === 'cut' || r.contractYearsRemaining > 1),
        ),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.pos,
      image: p.headshotUrl,
      rating: p.rating,
      age: p.age,
      ask: p.estValue / 1_000_000,
    }));
  // When no expiring list exists, use actual remaining contracts rather than synthetic FAs.
  if (!store.expiringContracts.length)
    for (const p of store.roster) {
      if (
        p.contractYearsRemaining === 1 &&
        p.status.toLowerCase() !== 'cut' &&
        !store.offseason.resolvedPlayerIds.includes(p.id)
      )
        pending.push({ ...heroPerson(p), ask: undefined });
    }
  const playoffGames =
    state.playoffs?.games.filter((g) => g.played && [g.homeTeam, g.awayTeam].includes(team)) ?? [];
  const loss = playoffGames.find((g) => g.winner !== team);
  const champion = state.playoffs?.champion === team;
  const madePlayoffs = Boolean(
    state.playoffs && Object.values(state.playoffs.seeds).flat().includes(team),
  );
  const rounds: Record<number, string> = {
    1: 'the Wild Card Round',
    2: 'the Divisional Round',
    3: 'the Conference Championship',
    4: 'the Super Bowl',
  };
  const outcome = champion
    ? 'won the Super Bowl'
    : loss
      ? `lost in ${rounds[loss.week] ?? 'the playoffs'}`
      : madePlayoffs
        ? 'reached the playoffs'
        : 'missed the playoffs';
  const assets = getTradableDraftPicksForTeam(store, team).filter(
    (p) => p.year === state.season + 1,
  );
  const picks = assets
    .map(
      (p) =>
        p.overallSlot ??
        (state.draftOrder.includes(p.originalTeamAbbr)
          ? (p.round - 1) * state.draftOrder.length +
            state.draftOrder.indexOf(p.originalTeamAbbr) +
            1
          : null),
    )
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);
  const info = TEAM_LIST.find((t) => t.abbr === team);
  const draft =
    Object.values(store.draftSessions).find(
      (d) => d.mode === 'real' && d.draftYear === state.season + 1,
    ) ??
    state.activeDraft ??
    state.completedDraft;
  return {
    capSpace: store.header.capSpace,
    pending,
    picks,
    pickCount: assets.length,
    teamName: info?.name ?? team,
    city: info?.city ?? team,
    outcome,
    champion,
    madePlayoffs,
    deepRun: playoffGames.some((g) => g.week >= 3),
    draft,
    action:
      phaseAction &&
      latest &&
      person?.headshotUrl &&
      (person.rating ?? 0) >= 75 &&
      contractYears &&
      apy != null
        ? {
            id: `${key}:${latest.id}`,
            type: latest.type as 're-sign' | 'signing',
            player: heroPerson(person),
            years: contractYears,
            total: apy * contractYears,
          }
        : undefined,
  };
}
