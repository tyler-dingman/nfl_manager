import { beatTeam, type BeatGraphicData } from './beat-model';

export type TransactionGraphic = Extract<BeatGraphicData, { family: 'transaction' }>;
export type TransactionType =
  | 'SIGNED'
  | 'ELEVATED'
  | 'ACTIVATED'
  | 'RELEASED'
  | 'WAIVED'
  | 'CLAIMED'
  | 'PROMOTED'
  | 'PLACED_ON_IR'
  | 'PRACTICE_SQUAD'
  | 'OTHER';
export type TransactionPlayer = {
  name: string;
  position?: string;
  jersey?: string;
  playerId?: string;
};
const positions: Record<string, string> = {
  'wide receiver': 'WR',
  'running back': 'RB',
  fullback: 'FB',
  'tight end': 'TE',
  quarterback: 'QB',
  linebacker: 'LB',
  'defensive tackle': 'DT',
  'defensive end': 'DE',
  'offensive tackle': 'OT',
  cornerback: 'CB',
  safety: 'S',
  kicker: 'K',
  punter: 'P',
  center: 'C',
  guard: 'G',
  tackle: 'OT',
  'offensive lineman': 'OL',
  'defensive lineman': 'DL',
  'long snapper': 'LS',
};
const pos =
  'QB|WR|RB|FB|TE|OL|OLB|ILB|LB|DL|DE|DT|OT|LT|RT|OG|T|G|C|CB|S|K|P|LS|' +
  Object.keys(positions)
    .map((p) =>
      p
        .split(' ')
        .map((w) => '[' + w[0].toUpperCase() + w[0] + ']' + w.slice(1))
        .join(' '),
    )
    .join('|');
const name =
  "[A-Z][A-Za-z’'.-]+ (?:(?:St\\.?|Van|van|De|de) )?[A-Z][A-Za-z’'.-]+(?: (?:Jr\\.?|Sr\\.?|II|III|IV))?";
const verbs =
  '[Ss]ign(?:s|ed)?|[Ee]levat(?:e|es|ed)|[Aa]ctivat(?:e|es|ed)|[Rr]eleas(?:e|es|ed)|[Ww]aiv(?:e|es|ed)|[Cc]laim(?:s|ed)?|[Pp]romot(?:e|es|ed)|[Pp]lac(?:e|es|ed)';
const actionFor = (verb: string): TransactionType =>
  /^sign|join/i.test(verb)
    ? 'SIGNED'
    : /^elevat/i.test(verb)
      ? 'ELEVATED'
      : /^activat/i.test(verb)
        ? 'ACTIVATED'
        : /^releas/i.test(verb)
          ? 'RELEASED'
          : /^waiv/i.test(verb)
            ? 'WAIVED'
            : /^claim/i.test(verb)
              ? 'CLAIMED'
              : /^promot/i.test(verb)
                ? 'PROMOTED'
                : 'PLACED_ON_IR';

/** Extract confirmed roster events, not source-category labels or speculative interest. */
export function extractBeatTransaction(story: {
  teamAbbr: string;
  headline: string;
  summary: string;
}): TransactionGraphic | undefined {
  const team = beatTeam(story.teamAbbr),
    h = story.headline;
  if (
    !team ||
    /\bcould\b|\bmight\b|\bmay\b|consider|rumor|potential|expected to|hopes? to|wants? to|should (?:sign|release)|trying to/i.test(
      h,
    )
  )
    return;
  if (/uniform|depth chart|foundation|broadcast|partnership|impact report/i.test(h)) return;
  if (
    /\b(?:signs?|adds?).*(?:practice squad|active roster)/i.test(h) &&
    /\b(?:signed|added)\b/i.test(story.summary)
  ) {
    const subject = story.summary.match(new RegExp('(' + pos + ')\\s+(' + name + ')'));
    if (subject && !new RegExp(name).test(h))
      return extractBeatTransaction({
        ...story,
        headline:
          'Sign ' +
          subject[1] +
          ' ' +
          subject[2] +
          (/practice squad/i.test(h) ? ' to practice squad' : ' to active roster'),
      });
  }
  const direct = h.match(
    new RegExp(
      '\\b(' +
        verbs +
        ')\\s+(?:[Vv]eteran |[Ee]xperienced |[Pp]romising [Rr]ookie |[Rr]ookie |[Ss]tar )?(?:(' +
        pos +
        ')\\s+)?(' +
        name +
        ')',
    ),
  );
  const passive = h.match(
    new RegExp(
      '(?:(' +
        pos +
        ')\\s+)?(' +
        name +
        ') (?:[Tt]o |[Hh]as |[Ii]s |[Ww]as )?(?:[Bb]een )?(' +
        verbs +
        '|[Jj]oin(?:s|ed)?)(?=\\s|$)',
    ),
  );
  const verb = direct?.[1] ?? passive?.[3];
  let playerName = direct?.[3] ?? passive?.[2];
  let position = direct?.[2] ?? passive?.[1];
  if (
    !verb ||
    !playerName ||
    /^(?:Two|Three|Four|Multiple|Several|New) (?:Players|Veterans|Signings|Faces)$/.test(playerName)
  )
    return;
  const action = actionFor(verb);
  if (action === 'PLACED_ON_IR' && !/\b(?:injured reserve|IR)\b/i.test(h)) return;
  if (
    /^join/i.test(verb) &&
    !/practice squad|active roster|\bsigns?\b|\bsigned\b/i.test(h + ' ' + story.summary)
  )
    return;
  if (Object.hasOwn(positions, playerName.toLowerCase())) {
    position = positions[playerName.toLowerCase()];
    const fromSummary = story.summary.match(
      new RegExp('(' + name + ') (?:provides|joins|has signed|signed)'),
    );
    if (!fromSummary) return;
    playerName = fromSummary[1];
  }
  position = position ? (positions[position.toLowerCase()] ?? position) : undefined;
  const samePlayerPosition = story.summary.match(
    new RegExp('(' + pos + ')\\s+' + playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
  if (!position && samePlayerPosition)
    position = positions[samePlayerPosition[1].toLowerCase()] ?? samePlayerPosition[1];
  const players: TransactionPlayer[] = [{ name: playerName, position }];
  if (!direct && passive && passive.index) {
    const prefix = h.slice(0, passive.index);
    const earlier = prefix.match(
      new RegExp('^(?:(' + pos + ')\\s+)?(' + name + ')(?:,|\\s+and|\\s+&)'),
    );
    if (earlier)
      players.unshift({
        name: earlier[2],
        position: earlier[1] ? (positions[earlier[1].toLowerCase()] ?? earlier[1]) : undefined,
      });
  }
  // Multiple different actions belong to a roundup, not a single arbitrary action.
  const actionWords = [...h.matchAll(new RegExp('\\b(' + verbs + ')\\b', 'g'))].map((m) =>
    actionFor(m[1]),
  );
  if (new Set(actionWords).size > 1) return;
  const tail = h.slice(
    (direct?.index ?? passive?.index ?? 0) + (direct?.[0].length ?? passive?.[0].length ?? 0),
  );
  for (const m of tail.matchAll(
    new RegExp('(?:,\\s*|\\s+(?:and|&)\\s+)(?:(' + pos + ')\\s+)?(' + name + ')', 'g'),
  )) {
    if (!/^(?:Make|Roster|Practice|Active|Injured|Ahead|From|Week|More|New)\b/.test(m[2]))
      players.push({
        name: m[2],
        position: m[1] ? (positions[m[1].toLowerCase()] ?? m[1]) : undefined,
      });
  }
  if (players.length > 2) return;
  const practice = /practice squad/i.test(h),
    fromPractice = /from (?:the )?practice squad/i.test(h);
  const destination =
    action === 'PLACED_ON_IR'
      ? 'INJURED RESERVE'
      : /to (?:the )?active roster/i.test(h) ||
          ((action === 'ELEVATED' || action === 'PROMOTED') && fromPractice)
        ? 'ACTIVE ROSTER'
        : practice && !fromPractice && !['RELEASED', 'WAIVED'].includes(action)
          ? 'PRACTICE SQUAD'
          : undefined;
  const origin = fromPractice
    ? 'PRACTICE SQUAD'
    : /from (?:the )?injured reserve|off (?:the )?injured reserve/i.test(h)
      ? 'INJURED RESERVE'
      : practice && ['RELEASED', 'WAIVED'].includes(action)
        ? 'PRACTICE SQUAD'
        : undefined;
  const terms =
    action === 'SIGNED' && players.length === 1
      ? (h + ' ' + story.summary).match(
          /\b(\d+|one|two|three|four|five|six)[- ]year,?\s+\$(\d+(?:\.\d+)?)\s*(million|billion)\b/i,
        )
      : null;
  const years = terms
    ? Number(terms[1]) ||
      ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>)[
        terms[1].toLowerCase()
      ]
    : undefined;
  const contract =
    terms && years
      ? {
          term: years + (years === 1 ? ' YEAR' : ' YEARS'),
          value: '$' + terms[2] + (terms[3].toLowerCase() === 'million' ? 'M' : 'B'),
        }
      : undefined;
  return {
    family: 'transaction',
    team,
    action,
    transactionType: action,
    name: playerName,
    position,
    destination,
    origin,
    ...(contract ? { contract } : {}),
    ...(players.length > 1 ? { players } : {}),
  };
}
