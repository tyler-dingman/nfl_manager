import { LAB_SCORE_CONFIG as C } from '../../../packages/parlay/lab-score-config';
import type {
  Opportunity,
  RoleContext,
  RoleObservation,
} from '../../../packages/parlay/role-evidence';
import type { HistoricalPlayerGame } from './types';

export const opportunityKeys = [
  'carries',
  'targets',
  'passingAttempts',
  'snapShare',
  'routes',
] as const;
const hours = (date: string, asOf: string) => (Date.parse(asOf) - Date.parse(date)) / 3_600_000;
const availableAt = (o: RoleObservation, asOf: string) =>
  hours(o.sourceAt, asOf) >= 0 && hours(o.receivedAt, asOf) >= 0;
export const freshObservation = (o: RoleObservation, asOf: string) =>
  availableAt(o, asOf) && hours(o.sourceAt, asOf) <= C.freshnessHours[o.kind];
const unavailable = (o?: RoleObservation) =>
  o && (['OUT', 'IR', 'SUSPENDED'].includes(o.status ?? '') || o.change === 'RELEASED');
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
function averages(rows: HistoricalPlayerGame[]): Opportunity {
  return Object.fromEntries(
    opportunityKeys.map((key) => [
      key,
      mean(rows.map((g) => g[key]).filter((v): v is number => v != null && Number.isFinite(v))),
    ]),
  ) as Opportunity;
}

export function expectedOpportunity(
  games: HistoricalPlayerGame[],
  playerId: string,
  context: RoleContext,
) {
  const logs = games
    .filter((g) => Date.parse(g.kickoffAt ?? g.date) < Date.parse(context.asOf))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const own = logs.filter((g) => g.playerId === playerId);
  const teamId = context.teamId ?? own[0]?.teamId;
  const observations = (context.observations ?? []).filter(
    (o) =>
      o.teamId === teamId &&
      ['QB', 'RB', 'WR', 'TE'].includes(o.position) &&
      availableAt(o, context.asOf),
  );
  // Stale evidence is excluded before resolving authority. Within each source class, newest wins.
  const fresh = observations
    .filter((o) => freshObservation(o, context.asOf))
    .sort(
      (a, b) =>
        Date.parse(b.sourceAt) - Date.parse(a.sourceAt) ||
        C.sourcePriority[a.kind] - C.sourcePriority[b.kind],
    );
  const latest = (id: string) =>
    fresh
      .filter((o) => o.playerId === id && (o.status || o.change === 'RELEASED'))
      .sort(
        (a, b) =>
          C.sourcePriority[a.kind] - C.sourcePriority[b.kind] ||
          Date.parse(b.sourceAt) - Date.parse(a.sourceAt),
      )[0];
  const depth = (id: string) =>
    fresh.find((o) => o.playerId === id && o.depthRank != null)?.depthRank;
  const current = latest(playerId);
  const recent = averages(own.slice(0, C.opportunity.recentGames));
  const baseline = averages(own.slice(C.opportunity.recentGames, C.opportunity.baselineGames));
  const expected = { ...recent };
  const ownEvidence = fresh.filter((o) => o.playerId === playerId);
  const depthHistory = observations
    .filter((o) => o.playerId === playerId && o.depthRank != null)
    .sort((a, b) => Date.parse(b.sourceAt) - Date.parse(a.sourceAt));
  const priorDepth = depthHistory.find((o) => o.depthRank !== depthHistory[0]?.depthRank);
  const depthChange =
    priorDepth && depth(playerId) != null ? priorDepth.depthRank! - depth(playerId)! : 0;
  for (const key of opportunityKeys) {
    const explicit = ownEvidence.find((o) => o.expected?.[key] != null)?.expected?.[key];
    if (explicit != null && Number.isFinite(explicit) && explicit >= 0) expected[key] = explicit;
  }
  const position = ownEvidence[0]?.position ?? own[0]?.position;
  const teammates = new Map<string, HistoricalPlayerGame[]>();
  const latestTeam = new Map<string, string>();
  for (const g of logs) {
    if (!latestTeam.has(g.playerId)) latestTeam.set(g.playerId, g.teamId);
    if (
      g.teamId !== teamId ||
      latestTeam.get(g.playerId) !== teamId ||
      !['QB', 'RB', 'WR', 'TE'].includes(g.position ?? '') ||
      !g.playerId
    )
      continue;
    const rows = teammates.get(g.playerId) ?? [];
    rows.push(g);
    teammates.set(g.playerId, rows);
  }
  const affected: string[] = [];
  const vacated = { carries: 0, targets: 0, passingAttempts: 0 };
  for (const [id, rows] of teammates) {
    if (id === playerId || !unavailable(latest(id))) continue;
    // If the missing teammate was already absent in recent games, that workload is already reflected.
    const overlapping = rows.filter((g) =>
      own.slice(0, C.opportunity.recentGames).some((o) => o.gameId === g.gameId),
    );
    if (!overlapping.length) continue;
    const volume = averages(overlapping);
    let inherited = false;
    for (const key of ['carries', 'targets', 'passingAttempts'] as const) {
      if (volume[key] == null) continue;
      const eligible = (p: string | null | undefined) =>
        key === 'targets'
          ? ['RB', 'WR', 'TE'].includes(p ?? '')
          : key === 'passingAttempts'
            ? p === 'QB'
            : p === rows[0]?.position;
      if (!eligible(position)) continue;
      const replacements = [...teammates].filter(
        ([other, history]) => !unavailable(latest(other)) && eligible(history[0]?.position),
      );
      if (!replacements.some(([id]) => id === playerId)) continue;
      const allocation = (other: string, history: HistoricalPlayerGame[]) => {
        const rank = depth(other);
        return (
          (averages(history.slice(0, C.opportunity.recentGames))[key] ?? 0) +
          (rank ? C.opportunity.depthPrior / rank : 0)
        );
      };
      const total = replacements.reduce(
        (sum, [other, history]) => sum + allocation(other, history),
        0,
      );
      const share = total > 0 ? allocation(playerId, own) / total : 0;
      const addition = volume[key]! * share * C.opportunity.redistribution;
      if (
        addition > 0 &&
        expected[key] != null &&
        !ownEvidence.some((o) => o.expected?.[key] != null)
      ) {
        // Own previous replacement games are more informative than distributing all work to the next depth-chart name.
        const replacementGames = own.filter(
          (g) =>
            g.teamId === teamId &&
            g.season === own[0]?.season &&
            observations.some(
              (o) =>
                o.playerId === id && unavailable(o) && freshObservation(o, g.kickoffAt ?? g.date),
            ),
        );
        const replacement = averages(replacementGames)[key];
        const inferred = expected[key]! + addition;
        expected[key] =
          replacement != null && replacement > recent[key]!
            ? inferred * (1 - C.opportunity.replacementBlend) +
              replacement * C.opportunity.replacementBlend
            : inferred;
        vacated[key] += addition;
        inherited = true;
      }
    }
    if (inherited) affected.push(latest(id)?.playerName ?? 'A teammate');
  }
  const conflict = ownEvidence.some((a) =>
    ownEvidence.some(
      (b) =>
        a !== b &&
        a.status &&
        b.status &&
        a.status !== b.status &&
        Math.abs(Date.parse(a.sourceAt) - Date.parse(b.sourceAt)) <
          3_600_000 * C.roleChange.conflictHours,
    ),
  );
  const unresolved = current?.status === 'QUESTIONABLE';
  const returning = fresh.some((o) => o.status === 'RETURNING' && o.position === position);
  const coaching = ownEvidence.some((o) => o.change === 'COACHING');
  const latestEvidence = new Map<string, RoleObservation>();
  for (const o of [...observations].sort(
    (a, b) => Date.parse(b.sourceAt) - Date.parse(a.sourceAt),
  )) {
    const key = `${o.playerId}:${o.kind}`;
    if (!latestEvidence.has(key)) latestEvidence.set(key, o);
  }
  const stale =
    [...latestEvidence.values()].some(
      (o) =>
        o.playerId === playerId &&
        !freshObservation(o, context.asOf) &&
        !fresh.some(
          (n) =>
            n.playerId === o.playerId &&
            Date.parse(n.sourceAt) > Date.parse(o.sourceAt) &&
            (o.status ? !!n.status : o.depthRank != null ? n.depthRank != null : !!n.expected),
        ),
    ) ||
    !own[0] ||
    hours(own[0].date, context.asOf) > C.freshnessHours.usage;
  const coverage =
    context.coverageAt &&
    hours(context.coverageAt, context.asOf) >= 0 &&
    hours(context.coverageAt, context.asOf) <= C.freshnessHours.report;
  const currentRoleKnown = !!ownEvidence.find((o) => o.kind === 'depth' || o.expected) && !!current;
  const depthKnown = depth(playerId) != null;
  const primary = position === 'QB' ? 'passingAttempts' : position === 'RB' ? 'carries' : 'targets';
  const changeRatio =
    expected[primary] != null && baseline[primary] != null
      ? (expected[primary]! - baseline[primary]!) /
        Math.max(baseline[primary]!, C.roleChange.minimumVolume)
      : null;
  const magnitude = Math.max(
    Math.abs(changeRatio ?? 0),
    ...(['snapShare', 'routes'] as const).map((key) =>
      expected[key] != null && baseline[key] != null
        ? Math.abs(expected[key]! - baseline[key]!) /
          Math.max(
            baseline[key]!,
            key === 'snapShare' ? C.roleChange.snapShareFloor : C.roleChange.minimumVolume,
          )
        : 0,
    ),
  );
  const declared = ownEvidence.find((o) => o.change);
  const promotion =
    declared?.change === 'PROMOTED' ? declared : depthChange > 0 ? depthHistory[0] : undefined;
  // A promotion is evidence of a changed role, not evidence for an exact new workload.
  // Do not project a starter from backup usage until we have a workload estimate,
  // vacated work, or usage observed after the promotion.
  const unquantifiedPromotion =
    !!promotion &&
    !ownEvidence.some((o) => o.expected?.[primary] != null) &&
    vacated[primary] === 0 &&
    !own.some((g) => Date.parse(g.kickoffAt ?? g.date) > Date.parse(promotion.sourceAt));
  const unconfirmedStarterWorkload =
    depth(playerId) === 1 &&
    (expected[primary] ?? 0) < (position === 'QB' ? 15 : position === 'RB' ? 5 : 2) &&
    !ownEvidence.some((o) => o.expected?.[primary] != null) &&
    vacated[primary] === 0;
  const severity =
    magnitude >= C.roleChange.major ||
    unavailable(current) ||
    declared?.change === 'PROMOTED' ||
    declared?.change === 'DEMOTED'
      ? 'MAJOR'
      : magnitude >= C.roleChange.moderate || affected.length || depthChange
        ? 'MODERATE'
        : magnitude >= C.roleChange.minor
          ? 'MINOR'
          : 'NONE';
  const direction =
    conflict ||
    unresolved ||
    returning ||
    ['TRADED', 'SIGNED', 'COACHING'].includes(declared?.change ?? '')
      ? 'UNCERTAIN'
      : unavailable(current) || declared?.change === 'DEMOTED'
        ? 'NEGATIVE'
        : depthChange
          ? depthChange > 0
            ? 'POSITIVE'
            : 'NEGATIVE'
          : changeRatio != null && changeRatio !== 0
            ? changeRatio > 0
              ? 'POSITIVE'
              : 'NEGATIVE'
            : 'UNCERTAIN';
  const committee =
    position === 'RB' &&
    [...teammates].filter(
      ([id, rows]) =>
        rows[0]?.position === 'RB' &&
        !unavailable(latest(id)) &&
        (averages(rows.slice(0, C.opportunity.recentGames)).carries ?? 0) >=
          Math.max(
            (expected.carries ?? 0) * C.opportunity.committeeRatio,
            C.opportunity.committeeMinimum,
          ),
    ).length > 1;
  const roleConfidence =
    (!currentRoleKnown && !depthKnown) ||
    conflict ||
    unresolved ||
    stale ||
    unquantifiedPromotion ||
    unconfirmedStarterWorkload
      ? 'LOW'
      : !currentRoleKnown ||
          returning ||
          committee ||
          coaching ||
          depthChange ||
          severity === 'MAJOR'
        ? 'MEDIUM'
        : 'HIGH';
  const reasons = [
    ...(unconfirmedStarterWorkload
      ? ['Current depth chart lists a starter, but starter-level workload is not established.']
      : []),
    ...(unquantifiedPromotion
      ? [
          'Promoted role has no established workload yet; backup production cannot establish an edge.',
        ]
      : []),
    ...affected.map(
      (name) => `${name} unavailable; vacated work shared among likely replacements.`,
    ),
    ...(depthChange
      ? ['Current depth-chart position changed; exact workload remains uncertain.']
      : []),
    ...(severity !== 'NONE'
      ? [
          `Expected ${primary} ${direction === 'POSITIVE' ? 'increased' : direction === 'NEGATIVE' ? 'decreased' : 'uncertain'}; different-role history receives less weight.`,
        ]
      : []),
    ...(!currentRoleKnown ? ['Current availability/depth evidence is incomplete.'] : []),
    ...(conflict ? ['Current role sources conflict.'] : []),
    ...(returning ? ['Returning player creates workload uncertainty.'] : []),
    ...(stale ? ['Role or latest usage information is stale.'] : []),
  ];
  return {
    expected,
    recent,
    baseline,
    primary,
    lastUsage: own[0]?.[primary] ?? null,
    roleConfidence,
    roleChange: { severity, direction },
    changeRatio,
    unavailable: !!unavailable(current),
    vacated,
    reasons,
    flags: { conflict, unresolved, returning, coaching, stale, committee },
    sources: [
      ...new Map(
        fresh
          .filter((o) => o.playerId === playerId || unavailable(o))
          .map(({ source, sourceAt, receivedAt, kind }) => [
            `${source}:${sourceAt}`,
            { source, sourceAt, receivedAt, kind },
          ]),
      ).values(),
    ],
    missing: opportunityKeys.filter((key) => expected[key] == null),
    currentRoleKnown,
    depthKnown,
    coverage: !!coverage,
    unquantifiedPromotion,
    unconfirmedStarterWorkload,
    position,
    depthRank: depth(playerId) ?? null,
  } as const;
}
