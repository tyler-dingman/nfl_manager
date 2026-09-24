import { extractBeatTransaction } from './beat-transaction';
import type { BeatGameMetadata } from '@/lib/canonical-game';
import accents from '../../../public/assets/the-beat-asset-library/config/team-accents.json';
import { beatTeam, standardVariant, validBeatGraphic, type BeatGraphicData } from './beat-model';

export type GraphicEvidence = {
  field: string;
  value: unknown;
  source: 'headline' | 'summary' | 'whatHappened' | 'canonical' | 'structured';
  excerpt: string;
};
export type BeatGraphicDecision = {
  game?: BeatGameMetadata;
  graphic: BeatGraphicData;
  displayCategory: string;
  reason: string;
  fallbackReason?: string;
  evidence: GraphicEvidence[];
  sourceUrls: string[];
  asOf?: string;
};
export type BeatStoryInput = {
  game?: BeatGameMetadata;
  id: string;
  teamAbbr: string;
  category: string;
  headline: string;
  summary: string;
  whatHappened?: string;
  updatedAt?: string;
  sources?: { url: string }[];
  graphic?: BeatGraphicData;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const teamNames = Object.entries(accents.teams)
  .flatMap(([abbr, { name }]) => {
    const nickname = name.split(' ').at(-1)!;
    return [name, nickname, ...(abbr === 'TB' ? ['Bucs'] : [])].map((label) => ({ abbr, label }));
  })
  .sort((a, b) => b.label.length - a.label.length);
const teamPattern = teamNames.map(({ label }) => escape(label)).join('|');
const teamFromText = (s: string) =>
  teamNames.find(({ label }) => label.toLowerCase() === s.toLowerCase())?.abbr;
const teamsIn = (s: string) => [
  ...new Set(
    [...s.matchAll(new RegExp('\\b(' + teamPattern + ')\\b', 'gi'))].map(
      (m) => teamFromText(m[1])!,
    ),
  ),
];
const positions: Record<string, string> = {
  'wide receiver': 'WR',
  'tight end': 'TE',
  quarterback: 'QB',
  'running back': 'RB',
  'outside linebacker': 'OLB',
  'inside linebacker': 'ILB',
  linebacker: 'LB',
  'defensive end': 'DE',
  'defensive tackle': 'DT',
  'offensive tackle': 'OT',
  'left tackle': 'LT',
  'right tackle': 'RT',
  cornerback: 'CB',
  safety: 'S',
  center: 'C',
  kicker: 'K',
  punter: 'P',
};
const positionPattern =
  Object.keys(positions)
    .map((p) => '[' + p[0].toUpperCase() + p[0] + ']' + p.slice(1))
    .join('|') + '|QB|WR|RB|TE|OLB|ILB|LB|DL|DE|DT|OT|LT|RT|CB|S|P|K';
const namePattern =
  "[A-Z][A-Za-z’'.-]+ (?:St\\.? )?[A-Z][A-Za-z’'.-]+(?: (?:Jr\\.?|Sr\\.?|II|III|IV))?";
const positionFor = (s: string) => positions[s.toLowerCase()] ?? s.toUpperCase();

/**
 * Editorial presentation only. Never mutates feed categories or borrows facts from
 * another article. Every populated factual field has a source excerpt. Title team
 * order is display order, explicitly not a home/away assertion.
 */
function classifyBeatStory(story: BeatStoryInput): BeatGraphicDecision {
  const evidence: GraphicEvidence[] = [];
  const h = story.headline;
  const fields = [
    ['headline', h],
    ['summary', story.summary],
    ['whatHappened', story.whatHappened ?? ''],
  ] as const;
  const all = fields.map(([, value]) => value).join('\n');
  const fact = (
    field: string,
    value: unknown,
    excerpt: string,
    source?: GraphicEvidence['source'],
  ) => {
    evidence.push({
      field,
      value,
      source: source ?? fields.find(([, text]) => text.includes(excerpt))?.[0] ?? 'canonical',
      excerpt,
    });
    return value;
  };
  const finish = (
    graphic: BeatGraphicData,
    reason: string,
    displayCategory: string,
  ): BeatGraphicDecision => ({
    graphic: validBeatGraphic(graphic) ? graphic : { family: standardVariant(story.id) },
    reason,
    displayCategory: validBeatGraphic(graphic) ? displayCategory : story.category,
    evidence,
    sourceUrls: story.sources?.map((s) => s.url) ?? [],
    asOf: story.updatedAt,
    ...(!validBeatGraphic(graphic)
      ? { fallbackReason: 'Required metadata is missing or exceeds the supported composition' }
      : graphic.family.startsWith('standard')
        ? { fallbackReason: reason }
        : {}),
  });
  if (story.graphic && validBeatGraphic(story.graphic)) {
    for (const [key, value] of Object.entries(story.graphic))
      fact(key, value, JSON.stringify(value), 'structured');
    return finish(
      story.graphic,
      'Validated structured graphic fields',
      story.graphic.family === 'transaction' ? 'Roster Move' : story.category,
    );
  }
  const rosterMove = extractBeatTransaction(story);
  if (rosterMove) {
    for (const [field, value] of Object.entries(rosterMove))
      if (value !== undefined)
        fact(
          field,
          value,
          field === 'team'
            ? story.teamAbbr
            : field === 'contract' || (field === 'name' && !story.headline.includes(String(value)))
              ? story.summary
              : story.headline,
          field === 'team' ? 'canonical' : undefined,
        );
    return finish(
      rosterMove,
      'Named roster action takes priority over source category',
      'Roster Move',
    );
  }
  const own = beatTeam(story.teamAbbr);
  const rosterVerbs =
    h.match(
      /\b(?:sign(?:s|ed)?|releas(?:e|es|ed)|waiv(?:e|es|ed)|elevat(?:e|es|ed)|promot(?:e|es|ed)|activat(?:e|es|ed))\b/gi,
    ) ?? [];
  if (
    own &&
    (rosterVerbs.length > 1 || /makes? roster move with/i.test(h)) &&
    !/uniform|depth chart|broadcast|foundation/i.test(h)
  ) {
    fact('team', own, story.teamAbbr, 'canonical');
    return finish(
      { family: 'roster-roundup', team: own },
      'Multiple or unspecified roster actions',
      'Roster Moves',
    );
  }

  const ownTeam = () => {
    if (own) fact('team', own, story.teamAbbr, 'canonical');
    return own;
  };
  const mentionedTeams = teamsIn(h);
  const pair = () => {
    const teams = [...mentionedTeams];
    if (teams.length === 1 && own && teams[0] !== own) teams.unshift(own);
    if (teams.length !== 2) return null;
    teams.forEach((team, i) =>
      fact(
        i ? 'rightTeam' : 'leftTeam',
        team,
        mentionedTeams.includes(team) ? h : story.teamAbbr,
        mentionedTeams.includes(team) ? 'headline' : 'canonical',
      ),
    );
    return { leftTeam: teams[0], rightTeam: teams[1] };
  };
  const week = () => {
    const m = all.match(/\bWeek\s+(\d{1,2})\b/i);
    return m ? (fact('week', 'W' + m[1], m[0]) as string) : undefined;
  };
  const kickoff = () => {
    const time = all.match(/\b(\d{1,2}:\d{2})\s*(AM|PM)(?:\s+(ET|CT|MT|PT|EST|EDT|CST|CDT))?\b/i);
    if (!time) return undefined;
    const day = all.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
    const label =
      (day ? day[1].slice(0, 3).toUpperCase() + ' · ' : '') +
      time[1] +
      ' ' +
      time[2].toUpperCase() +
      (time[3] ? ' ' + time[3].toUpperCase() : '');
    fact('kickoff', label, time[0]);
    if (day) fact('kickoffDay', day[1], day[0]);
    return label;
  };
  // Context exclusions precede NFL-specific formats.
  if (
    /donat|alumni|girls.? flag|high.school|youth (?:award|football|clinic)|giving back|nonprofit|pop-up retail|hygiene.*campaign|school uniform|blood drive|volunteer|cancer awareness|coach of the week|football digest|5-city tour|charity|foundation/i.test(
      h,
    )
  )
    return finish(
      { family: 'business-community', label: 'COMMUNITY' },
      'Explicit community, school or youth context',
      'Community',
    );
  if (
    /uniform|merchandise|pro shop|(?:official|inaugural|security) .*partner|charity|foundation/i.test(
      h,
    )
  )
    return finish(
      {
        family: 'business-community',
        label: /uniform|merchandise|pro shop/i.test(h) ? 'TEAM\nSTYLE' : 'BUSINESS',
      },
      'Uniform/merchandise feature, not a game preview',
      'Business',
    );
  if (/depth chart/i.test(h))
    return finish(
      { family: 'depth-chart' },
      'Published depth chart; release is not a player transaction',
      'Depth chart',
    );
  if (
    /mailbag|inbox|you['’]ve got mail|ask the old guy|fan questions|asked and answered|Q&A/i.test(h)
  )
    return finish({ family: 'mailbag' }, 'Explicit recurring Q&A format', 'Mailbag');
  if (/power rankings|betting odds|expert predictions|what are the odds/i.test(h))
    return finish(
      { family: standardVariant(story.id) },
      'Rankings/prediction editorial lacks a verified display rank or completed primary result',
      story.category,
    );
  const matrix = h.match(/\b(\d{1,2})[x×](\d)\s*:/i);
  if (matrix) {
    const count = matrix[1] + '×' + matrix[2];
    fact('count', count, matrix[0]);
    return finish(
      { family: 'numbered', count, descriptor: 'NAMES\nNUMBERS & NOTES' },
      'Explicit matrix editorial format',
      'Numbered',
    );
  }
  const statList = h.match(/\b(\d{1,2}) (?:key )?stats (?:to know|of note)\b/i);
  if (statList) {
    fact('count', statList[1], statList[0]);
    return finish(
      { family: 'stats', count: statList[1], descriptor: 'KEY\nSTATS', rows: [] },
      'Explicit numbered-stat editorial; unverified supporting values omitted',
      'Stats',
    );
  }
  const count = h.match(
    /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+((?:big )?takeaways|quick facts|numbers of note|final thoughts|observations|(?:interesting )?things(?: to know| to watch| we learned| said)?|notes)\b/i,
  );
  if (count && !/week\s+$/i.test(h.slice(0, count.index))) {
    const numbers = [
      'zero',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
    ];
    const n = /^\d+$/.test(count[1]) ? count[1] : String(numbers.indexOf(count[1].toLowerCase()));
    const descriptor = /takeaways/i.test(count[2])
      ? 'TAKEAWAYS'
      : /quick facts/i.test(count[2])
        ? 'QUICK\nFACTS'
        : /numbers of note/i.test(count[2])
          ? 'NUMBERS\nOF NOTE'
          : /final thoughts/i.test(count[2])
            ? 'FINAL\nTHOUGHTS'
            : /observations/i.test(count[2])
              ? 'OBSERVATIONS'
              : /to know/i.test(count[2])
                ? 'THINGS\nTO KNOW'
                : /to watch/i.test(count[2])
                  ? 'THINGS\nTO WATCH'
                  : /notes/i.test(count[2])
                    ? 'NOTES'
                    : /learned/i.test(h)
                      ? 'THINGS\nLEARNED'
                      : /said/i.test(h)
                        ? 'THINGS\nSAID'
                        : 'THINGS\nTO KNOW';
    fact('count', n, count[0]);
    fact('descriptor', descriptor, h);
    return finish(
      { family: 'numbered', count: n, descriptor },
      'Explicit numbered editorial format takes precedence',
      'Takeaways',
    );
  }
  if (
    /top plays|film (?:room|study|breakdown)|tape talk|scheme breakdown|play analysis|all-22/i.test(
      h,
    )
  )
    return finish({ family: 'film' }, 'Explicit film breakdown', 'Film');
  if (
    /know your foe|opponent preview|scouting report|defense.*(?:facing|prepar)|real talent.*(?:preview|week)/i.test(
      h,
    )
  ) {
    const opponent = teamsIn(all).find((t) => t !== own);
    if (opponent)
      fact('opponent', opponent, fields.find(([, text]) => teamsIn(text).includes(opponent))![1]);
    return finish({ family: 'scouting', opponent }, 'Explicit opponent/scouting focus', 'Scouting');
  }
  if (
    own &&
    (/transactions\b|roster update|place .*injured reserve.*release|(?:sign|elevate)s? (?:two|three|multiple) (?:players|veterans)/i.test(
      h,
    ) ||
      (/roster moves/i.test(h) && !/roster moves:.*(?:sign|release|waive|elevate)/i.test(h)))
  )
    return finish(
      { family: 'roster-roundup', team: ownTeam()! },
      'Multiple or unspecified roster moves; no single signing asserted',
      'Roster moves',
    );
  if (
    /\b(?:sign|elevate|release|waive)s?\b.+\band\b.+\b(?:RB|WR|QB|LB|DL|DE|DT|CB|S|TE|P|K)\b/i.test(
      h,
    ) &&
    own
  )
    return finish(
      { family: 'roster-roundup', team: ownTeam()! },
      'Multiple named player moves',
      'Roster moves',
    );
  if (own && /place.*injured reserve/i.test(h) && /corresponding move/i.test(story.summary))
    return finish(
      { family: 'roster-roundup', team: ownTeam()! },
      'Corresponding injury-list and signing moves',
      'Roster moves',
    );
  if (
    own &&
    /(?:promote|sign|place).*(?:,|;).*(?:signed|sign|place|release)/i.test(h) &&
    /injured reserve|\bIR\b/i.test(h)
  )
    return finish(
      { family: 'roster-roundup', team: ownTeam()! },
      'Multiple roster actions, not an arbitrary player update',
      'Roster moves',
    );
  const added = h.match(
    new RegExp(
      '\\badd(?:s|ed)? (?:experienced |veteran )?(?:returner|receiver|linebacker|quarterback) (' +
        namePattern +
        ')',
    ),
  );
  if (added && own && /(?:added|signed).*(?:practice squad|active roster)/i.test(story.summary)) {
    fact('name', added[1], added[0]);
    fact('action', 'ADDED', added[0]);
    const destination = /to (?:the )?practice squad/i.test(story.summary)
      ? 'PRACTICE SQUAD'
      : undefined;
    if (destination) fact('destination', destination, story.summary);
    return finish(
      { family: 'transaction', team: ownTeam()!, action: 'ADDED', name: added[1], destination },
      'Explicit named roster addition',
      'Transaction',
    );
  }
  if (/transcript|press conference/i.test(h)) {
    const m = h.match(/(?:HC|DC|OC|STC|QB|S)\s+(.+?)\s+Press Conference/i);
    const name = m?.[1];
    if (name) fact('name', name, m![0]);
    return finish(
      { family: 'interview', name, transcript: /transcript/i.test(h) },
      'Transcript has no verified useful quotation; use Standard',
      'Interview',
    );
  }
  const playerMatch = all.match(
    new RegExp('\\b(' + positionPattern + ')\\s+(' + namePattern + ')'),
  );
  // Also accept an anchored named subject only for an explicit feature format.
  const featureMatch = h.match(
    new RegExp(
      '^(' +
        namePattern +
        ")(?:'s|’s)? (?:[Tt]akes [Aa]dvantage|proving|[Bb]ounce-back|week-to-week|ruled|[Cc]ould [Bb]e [Ss]idelined)",
    ),
  );
  const seasonSubject = h.match(
    new RegExp(
      '(' + namePattern + ') (?:Could Be Sidelined For Season|suffers season-ending)',
      'i',
    ),
  );
  const player = playerMatch?.[2] ?? featureMatch?.[1] ?? seasonSubject?.[1];
  const position = playerMatch ? positionFor(playerMatch[1]) : undefined;
  if (
    player &&
    !/injury report|inactives?\b/i.test(h) &&
    /injury|week-to-week|rule[ds]? out|x-rays|sidelined for season|season-ending|injured reserve/i.test(
      h,
    )
  ) {
    const statusMatch = all.match(
      /could be sidelined for season|season-ending|injured reserve|could miss multiple weeks|questionable to return|week-to-week|rule[ds]? OUT|x-rays[^.\n]*?negative|did not participate|\bDNP\b/i,
    );
    const status = statusMatch
      ? /rule[ds]? out/i.test(statusMatch[0])
        ? 'OUT'
        : /x-rays/i.test(statusMatch[0])
          ? 'X-RAYS NEGATIVE'
          : statusMatch[0].toUpperCase()
      : 'INJURY UPDATE';
    fact('name', player, playerMatch?.[0] ?? featureMatch?.[0] ?? seasonSubject![0]);
    if (position) fact('position', position, playerMatch![0]);
    if (statusMatch) fact('status', status, statusMatch[0]);
    const context = /questionable to return/i.test(status)
      ? 'IN-GAME UPDATE'
      : /two others|several players/i.test(h)
        ? 'PRACTICE ROUNDUP'
        : undefined;
    if (context) fact('context', context, context === 'IN-GAME UPDATE' ? statusMatch![0] : h);
    return finish(
      { family: 'player', name: player, position, status, context },
      'Named player injury status with original time/game context',
      'Player update',
    );
  }
  if (/injury (?:report|updates?)|inactives?\b/i.test(h)) {
    const period = week();
    const practice = all.match(/\bDNP\b|did not participate/i);
    if (practice) fact('detail', 'PRACTICE REPORT · DNP', practice[0]);
    return finish(
      {
        family: 'injury',
        period,
        rows: [],
        detail: /inactives?\b/i.test(h)
          ? 'INACTIVE\nREPORT'
          : /\bDNP\b|did not participate/i.test(all)
            ? 'PRACTICE\nREPORT · DNP'
            : 'INJURY\nREPORT',
      },
      'Report topic; unknown aggregate status totals omitted',
      'Injury',
    );
  }
  if (/inside (?:the )?numbers|by the numbers|data crunch|grades & snap counts/i.test(h)) {
    const m = all.match(/(\d+(?:\.\d+)?)\s+yards per carry/i);
    const rows = m ? [{ value: m[1], label: 'YARDS PER CARRY' }] : [];
    if (m) {
      fact('rows.0.value', m[1], m[0]);
      fact('rows.0.label', 'YARDS PER CARRY', m[0]);
    }
    return finish(
      { family: 'stats', descriptor: 'BY THE\nNUMBERS', rows },
      'Explicit statistics format; only sourced values displayed',
      'Stats',
    );
  }
  const score = h.match(
    new RegExp(
      '(' + teamPattern + ')\\s+(\\d{1,2}),?\\s+(' + teamPattern + ')\\s+(\\d{1,2})(?:\\b)',
      'i',
    ),
  );
  if (score && /final|recap|rapid reaction|game report|highlights/i.test(h)) {
    const graphic: BeatGraphicData = {
      family: 'game-result',
      leftTeam: teamFromText(score[1])!,
      rightTeam: teamFromText(score[3])!,
      leftScore: +score[2],
      rightScore: +score[4],
      final: /overtime|\bOT\b/i.test(all) ? 'FINAL · OT' : 'FINAL',
    };
    for (const [key, value] of Object.entries(graphic))
      fact(key, value, key === 'final' ? h : score[0]);
    return finish(graphic, 'Explicit named team-score pairs; no home/away inference', 'Final');
  }
  const defeat = h.match(
    new RegExp(
      '(' +
        teamPattern +
        ')\\s+(?:defeat|beat|outlast)s?\\s+(?:the )?(' +
        teamPattern +
        ')[^0-9|]{0,45}(\\d{1,2})[-–—](\\d{1,2})',
      'i',
    ),
  );
  const outcome = all.match(
    new RegExp(
      '(\\d{1,2})[-–—](\\d{1,2})\\s+(win over|win at|loss to|loss at|victory over|defeat to)\\s+(?:the )?(' +
        teamPattern +
        ')',
      'i',
    ),
  );
  if (
    defeat ||
    (outcome &&
      own &&
      /recap|game report|game observations|instant analysis|defeat|victory|\bwin\b|\bloss\b|final|rapid reaction/i.test(
        h,
      ) &&
      !/power rankings|nominated|award|rookie of the week|notebook|from the podium|appreciates|drive of the game/i.test(
        h,
      ))
  ) {
    const leftTeam = defeat ? teamFromText(defeat[1])! : own!;
    const rightTeam = teamFromText(defeat ? defeat[2] : outcome![4])!;
    const a = +(defeat ? defeat[3] : outcome![1]);
    const b = +(defeat ? defeat[4] : outcome![2]);
    const loss = !defeat && /loss|defeat/.test(outcome![3]);
    const graphic: BeatGraphicData = {
      family: 'game-result',
      leftTeam,
      rightTeam,
      leftScore: loss ? Math.min(a, b) : Math.max(a, b),
      rightScore: loss ? Math.max(a, b) : Math.min(a, b),
      final: /overtime|\bOT\b/i.test(all) ? 'FINAL · OT' : 'FINAL',
    };
    for (const [key, value] of Object.entries(graphic)) {
      if (key === 'leftTeam' && !defeat) fact(key, value, story.teamAbbr, 'canonical');
      else
        fact(
          key,
          value,
          key === 'final'
            ? (all.match(/overtime|\bOT\b/i)?.[0] ?? defeat?.[0] ?? outcome![0])
            : (defeat?.[0] ?? outcome![0]),
        );
    }
    return finish(
      graphic,
      'Explicit completed-game outcome and score, with named opponent',
      'Final',
    );
  }
  const falls = h.match(
    new RegExp(
      '(' +
        teamPattern +
        ') (?:fall|falls|lose|loses) to (?:the )?(' +
        teamPattern +
        '),? (\\d{1,2})[-–—](\\d{1,2})',
      'i',
    ),
  );
  if (falls) {
    const graphic: BeatGraphicData = {
      family: 'game-result',
      leftTeam: teamFromText(falls[1])!,
      rightTeam: teamFromText(falls[2])!,
      leftScore: Math.min(+falls[3], +falls[4]),
      rightScore: Math.max(+falls[3], +falls[4]),
      final: 'FINAL',
    };
    for (const [key, value] of Object.entries(graphic)) fact(key, value, falls[0]);
    return finish(graphic, 'Explicit named losing team and completed score', 'Final');
  }
  const lossScore = all.match(/(\d{1,2})[-–—](\d{1,2}) (?:defeat|loss)\b/i);
  if (
    lossScore &&
    own &&
    /in loss|loss to|defeat/i.test(h) &&
    mentionedTeams.includes(own) &&
    mentionedTeams.length === 2
  ) {
    const opponent = mentionedTeams.find((t) => t !== own)!;
    const graphic: BeatGraphicData = {
      family: 'game-result',
      leftTeam: own,
      rightTeam: opponent,
      leftScore: Math.min(+lossScore[1], +lossScore[2]),
      rightScore: Math.max(+lossScore[1], +lossScore[2]),
      final: 'FINAL',
    };
    fact('leftTeam', own, h);
    fact('rightTeam', opponent, h);
    fact('leftScore', graphic.leftScore, lossScore[0]);
    fact('rightScore', graphic.rightScore, lossScore[0]);
    fact('final', 'FINAL', lossScore[0]);
    return finish(graphic, 'Explicit loss and score with both named teams', 'Final');
  }
  if (
    player &&
    (featureMatch || /reliable|bounce-back|takes advantage|offense is close/i.test(h))
  ) {
    fact('name', player, playerMatch?.[0] ?? featureMatch?.[0] ?? seasonSubject![0]);
    if (position) fact('position', position, playerMatch![0]);
    return finish(
      { family: 'player', name: player, position },
      'Named player feature supported by article text',
      'Player focus',
    );
  }
  if (story.category === 'COACHING' && /strategy|scheme/i.test(h))
    return finish(
      { family: 'coaching', label: 'GAME\nPLAN' },
      'Explicit coaching strategy',
      'Coaching',
    );
  if (/recap|loss to|fall to|heartbreaker|in loss|fourth-quarter loss/i.test(h)) {
    const teams = mentionedTeams.slice(0, 2);
    if (own && !teams.includes(own) && teams.length < 2) teams.unshift(own);
    teams.forEach((team, i) =>
      fact(
        'teams.' + i,
        team,
        mentionedTeams.includes(team) ? h : story.teamAbbr,
        mentionedTeams.includes(team) ? 'headline' : 'canonical',
      ),
    );
    const overtime = /overtime|\bOT\b/i.test(h);
    if (overtime) fact('overtime', true, h);
    return finish(
      { family: 'recap', teams, overtime },
      'Recap without a verified score pair',
      'Recap',
    );
  }
  if (
    (/preview|how to watch|how.*(?:listen|stream|watch)|top storylines|live game updates|live in-game|matchup/i.test(
      h,
    ) ||
      new RegExp('^(?:' + teamPattern + ')\\s+(?:vs\\.?|at)\\s+(?:' + teamPattern + ')', 'i').test(
        h,
      )) &&
    mentionedTeams.length &&
    !/observations|postgame|recap/i.test(h)
  ) {
    const teams = pair();
    if (teams)
      return finish(
        { family: 'game-matchup', ...teams, week: week(), kickoff: kickoff() },
        'Identified teams in an explicit matchup/preview format',
        'Matchup',
      );
  }
  if (story.category === 'COACHING')
    return finish(
      { family: 'coaching', label: /strategy|scheme/i.test(h) ? 'GAME\nPLAN' : 'COACHING\nUPDATE' },
      'Coaching topic; scheme label only when explicit',
      'Coaching',
    );
  if (/around (?:the )?(?:nfl|afc|nfc)|^(?:AFC|NFC) (?:NORTH|SOUTH|EAST|WEST):/i.test(h))
    return finish({ family: 'league' }, 'Explicit league/division roundup', 'League');
  if (story.category === 'PRACTICE' || /practice (?:notebook|report)/i.test(h))
    return finish(
      { family: 'practice' },
      'Practice editorial without a verified player transaction',
      'Practice',
    );
  return finish(
    { family: standardVariant(story.id) },
    'General analysis or insufficient evidence for a specific editorial format',
    story.category,
  );
}

/** Canonical enrichment is supplied by the server; no schedule lookup or text-time parsing here. */
export function adaptBeatStory(story: BeatStoryInput): BeatGraphicDecision {
  const decision = classifyBeatStory(story);
  const game = story.game;
  if (!game) return decision;
  const primaryGame =
    ['game-matchup', 'game-result', 'recap'].includes(decision.graphic.family) ||
    (decision.graphic.family.startsWith('standard') &&
      /how to watch|watch and stream|game preview|know before you go|expert picks|game recap|game result/i.test(
        story.headline,
      ));
  if (primaryGame) {
    // Away/home ordering is stable for every story, regardless of title order or selected team.
    decision.graphic =
      game.status === 'FINAL' && game.homeScore !== null && game.awayScore !== null
        ? {
            family: 'game-result',
            leftTeam: game.awayTeam,
            rightTeam: game.homeTeam,
            leftScore: game.awayScore,
            rightScore: game.homeScore,
            final: game.overtime ? 'FINAL · OT' : 'FINAL',
          }
        : {
            family: 'game-matchup',
            leftTeam: game.awayTeam,
            rightTeam: game.homeTeam,
            week: game.weekDisplay,
            kickoff: game.kickoffDisplay,
          };
    decision.displayCategory = decision.graphic.family === 'game-result' ? 'Final' : 'Matchup';
    decision.reason = 'Resolved canonical NFL game';
    delete decision.fallbackReason;
  }
  return {
    ...decision,
    game,
    evidence: [
      ...decision.evidence,
      {
        field: 'game',
        value: game,
        source: 'canonical',
        excerpt: 'historical_games/' + game.gameId,
      },
    ],
  };
}
