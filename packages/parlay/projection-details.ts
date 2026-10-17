import { labScoreBand } from './lab-score-config';
import type { LabScoreV2 } from '../../src/server/historical-stats/lab-score-v2';
import type { HomeMarket, ResearchDetail } from './research';
export const SCORE_GAUGE_PATH = 'M 36 144 A 82 82 0 1 1 164 144';
export const SCORE_GAUGE_LENGTH = 82 * (2 * Math.PI - 2 * Math.asin(64 / 82));
export const modelNumber = (v: number | null | undefined, signed = false) =>
  v == null || !Number.isFinite(v) ? '—' : `${signed && v > 0 ? '+' : ''}${Number(v.toFixed(1))}`;
/** Consumer copy shared by native and web. Model diagnostics remain in API/admin tooling. */
export function projectionDetails(
  p: LabScoreV2 | undefined,
  _active: boolean,
  stat: string,
  position?: string | null,
) {
  const n = modelNumber;
  const known = p?.projection != null && p.estimatedProbability != null;
  const score = known ? p!.score : null;
  const confidence =
    score == null
      ? 'UNAVAILABLE'
      : score >= 90
        ? 'HIGH'
        : score >= 80
          ? 'GOOD'
          : score >= 60
            ? 'MODERATE'
            : 'LOW';
  const material = !!p && ['MODERATE', 'MAJOR'].includes(p.roleChange.severity);
  const changed =
    p?.roleChange.direction === 'POSITIVE'
      ? 'increased'
      : p?.roleChange.direction === 'NEGATIVE'
        ? 'decreased'
        : 'is uncertain';
  const roleRank = p?.role?.match(/depth rank (\d+)/i)?.[1];
  const rolePosition = position ?? p?.role?.split(' · ')[0];
  const role = roleRank
    ? `${Number(roleRank) === 1 ? 'Starting' : 'Backup'} ${rolePosition ?? 'player'}`
    : 'Role not confirmed';
  const passing = /pass|interception/i.test(stat),
    receiving = /receiv|reception/i.test(stat);
  const o = p?.expectedOpportunity;
  const work = passing
    ? [[o?.passingAttempts, 'attempts']]
    : receiving
      ? [
          [o?.targets, 'targets'],
          [o?.routes, 'routes'],
        ]
      : [
          [o?.carries, 'carries'],
          [o?.targets, 'targets'],
        ];
  const expectedWork =
    work
      .filter(([v]) => typeof v === 'number')
      .map(([v, label]) => `~${n(v as number)} ${label}`)
      .join(' / ') || 'Not established';
  const weakHistory = !p || p.roleAdjusted.games < 3 || p.roleAdjusted.effectiveSample < 3;
  const conflict = p?.recommendation && p.recommendation !== p.side;
  const sentence = !known
    ? 'There is not enough current information to estimate confidence.'
    : conflict
      ? `The projection leans ${p!.recommendation}; confidence in the selected ${p!.side} is limited.`
      : p!.roleConfidence === 'LOW'
        ? `Confidence is limited by ${material ? 'a changing role and limited comparable history' : 'uncertain workload or incomplete current information'}.`
        : weakHistory
          ? 'Few historical games resemble the expected workload.'
          : confidence === 'HIGH' || confidence === 'GOOD'
            ? 'The projected edge is supported by current workload and comparable history.'
            : 'Some signals support the projected edge, but meaningful uncertainty remains.';
  const reason = p?.reasons.find((r) =>
    /unavailable|returning|depth-chart|sources conflict/i.test(r),
  );
  const componentLabels = {
    edge: 'Projection Edge',
    recent: 'Recent Performance',
    matchup: 'Matchup Advantage',
    opportunity: 'Opportunity & Usage',
    history: 'Historical Consistency',
    environment: 'Game Environment',
  };
  return {
    band: score == null ? 'UNAVAILABLE' : labScoreBand(score).label,
    breakdown: Object.entries(componentLabels).map(([key, label]) => ({
      label,
      score: p?.components[key as keyof typeof componentLabels] ?? null,
      weight: p?.componentWeights?.[key as keyof typeof componentLabels] ?? null,
    })),
    probability:
      p?.estimatedProbability == null
        ? 'Unavailable'
        : `${n(p.estimatedProbability * 100)}% · model estimate, not calibrated`,
    value:
      p?.bettingValue?.expectedReturn == null
        ? 'Unavailable'
        : `${n(p.bettingValue.expectedReturn * 100, true)}% estimated return per unit staked`,
    reliability:
      p?.dataQuality == null
        ? 'Unavailable'
        : `${n(p.dataQuality.completeness)}% component coverage · ${n(p.dataQuality.reliability * 100)}% evidence reliability`,
    explanation: p?.reasons.join(' ') ?? 'Current evidence unavailable.',
    score,
    confidence,
    sentence,
    pick: p ? `${p.side} ${n(p.line)}` : 'No pick available',
    stat,
    lean: p?.recommendation
      ? `Why the model leans ${p.recommendation}`
      : 'What the model can tell us',
    metrics: [
      ['Projection', n(p?.projection)],
      ['Line', n(p?.line)],
      ['Edge', n(p?.edge, true)],
    ],
    signals: [
      {
        label: 'Role',
        value: role,
        note: roleRank ? `Depth rank #${roleRank}` : 'Current workload uncertain',
      },
      { label: 'Expected work', value: expectedWork, note: 'Opportunity-based projection' },
      {
        label: 'History',
        value:
          p?.roleAdjusted.hitRate != null
            ? `${n(p.roleAdjusted.hitRate)}% ${p.side}`
            : p?.rawL10.games
              ? `${p.rawL10.hits}/${p.rawL10.games} ${p.side}`
              : 'Limited history',
        note: weakHistory
          ? 'Limited comparable action'
          : `${p?.roleAdjusted.games} comparable games · role-adjusted`,
      },
    ],
    material,
    calloutTitle: material ? 'Role change detected' : 'Model insight',
    roleConfidence: p?.roleConfidence ?? 'LOW',
    calloutLead: material
      ? (reason ?? `Expected workload ${changed === 'is uncertain' ? changed : `has ${changed}`}.`)
      : 'Historical performance is not model confidence.',
    calloutText: material
      ? `Expected opportunity ${changed === 'is uncertain' ? 'is uncertain' : `has ${changed}`}. Games with a different workload receive less weight; ${p?.roleConfidence === 'LOW' ? 'the current role remains uncertain' : 'comparable games carry more influence'}.`
      : sentence,
    historyNote:
      'Historical hit rates describe past games, not the probability of this pick winning.',
  };
}
export function overviewContext(data: ResearchDetail, market: HomeMarket) {
  const n = modelNumber,
    p = data.summary.projection;
  const opponent = data.market.opponentId;
  const defense = data.currentOpponentStrength;
  const vs = data.opponentVsPosition;
  const matchup: string[][] = [];
  if (defense) matchup.push([`${defense.defenseLabel} (${defense.season})`, `#${defense.rank}`]);
  if (vs?.last10.games) {
    matchup.push([
      `${vs.label} ${market.side.toLowerCase()} · last ${vs.last10.games}`,
      `${n(vs.last10.hitRate)}%`,
    ]);
    if (vs.last10.average != null)
      matchup.push(['Opposing average · selected stat', n(vs.last10.average)]);
    matchup.push(['Sample confidence', vs.sampleConfidence]);
  }
  if (p && p.matchup !== 'Unavailable') matchup.push(['Model matchup signal', p.matchup]);
  const environment: string[][] = [];
  if (data.gameScript?.total != null) environment.push(['Game total', n(data.gameScript.total)]);
  if (data.gameScript?.spread != null)
    environment.push(['Team spread', n(data.gameScript.spread, true)]);
  if (data.environment?.currentGame?.dayNight)
    environment.push([
      'Kickoff',
      data.environment.currentGame.dayNight === 'NIGHT' ? 'Night game' : 'Day game',
    ]);
  if (data.venue?.current?.roofType && data.venue.current.roofType !== 'UNKNOWN')
    environment.push(['Venue', data.venue.current.roofType.replaceAll('_', ' ')]);
  if (data.environment?.currentGame?.restDays != null)
    environment.push(['Rest', `${data.environment.currentGame.restDays} days`]);
  return {
    opponent,
    matchup,
    environment,
    tiles: [
      {
        label: 'Trend',
        value: data.summary.last10.games
          ? `${data.summary.last10.hits}/${data.summary.last10.games}`
          : '—',
        note: `${market.side.toLowerCase()} · last ${data.summary.last10.games} games`,
        target: 'Game Log',
      },
      {
        label: 'Matchup',
        value: opponent ? `vs ${opponent}` : '—',
        note: defense ? `${defense.defenseLabel} #${defense.rank}` : 'Matchup context unavailable',
        target: 'Matchup',
      },
      {
        label: 'Usage',
        value: n(data.usage.last5),
        note: `${data.usage.primaryMetric} / game · L5`,
        target: 'Game Log',
      },
      {
        label: 'Line cushion',
        value: n(data.lineMargin.averageMargin, true),
        note: 'Historical avg margin · L10',
        target: 'Line Ladder',
      },
    ],
  };
}
