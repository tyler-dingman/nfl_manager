import {
  offseasonHeroCandidates,
  offseasonHeroPhases,
  type OffseasonHeroContext,
} from './hero-offseason';
import { heroGraphic, type HeroGraphic, type HeroFacility } from './hero-assets';
import type { FranchiseSimulationState, SimulatedPlayerStat } from '../../src/types/front-office';
import {
  buildPlayoffPicture,
  buildStandingsSnapshot,
  rankStandings,
} from '../../src/lib/front-office-standings';

export type HeroPerson = {
  id: string;
  name: string;
  position?: string;
  image?: string | null;
  rating?: number;
  age?: number;
  years?: number;
  team?: string;
  ask?: number;
  capHit?: number;
};
export type HeroStory = {
  season: number;
  week: number;
  templateId: string;
  category: string;
  visualType:
    | 'coach'
    | 'player'
    | 'free-agent'
    | 'trade-player'
    | 'prospect'
    | 'stadium'
    | HeroGraphic;
  subjectId?: string;
  subjectName?: string;
  subjectDetail?: string;
  image: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
  subjectPlayer?: import('../../src/types/player').PlayerRowDTO;
  playerId?: string;
  phase?: string;
  contextSignature?: string;
  postActionId?: string;
  simulatedDialogue?: boolean;
  projectedPick?: number;
};
export type HeroContext = {
  offseason?: OffseasonHeroContext;
  state: FranchiseSimulationState;
  team: string;
  stadium: string;
  players: HeroPerson[];
  freeAgents: HeroPerson[];
  targets: HeroPerson[];
  coach?: HeroPerson;
  needs: string[];
  deadlineWeek: number;
  offers: Array<{ playerId: string; count: number }>;
  prospects: Array<
    HeroPerson & { rank: number; priorRank: number; school?: string; low: number; high: number }
  >;
  injuries?: Array<{ playerId: string; detail: string }>;
  projectedPick?: number;
  priorProjectedPick?: number;
  ownership?: {
    attendance: number;
    facility: string;
    grade: string;
    sentiment: string;
    facilities?: HeroFacility[];
  };
};
export type HeroCandidate = HeroStory & { weight: number; priority: number };
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
export const heroWeek = (state: FranchiseSimulationState) =>
  /^week-(\d+)$/.test(state.phase) ? Number(state.phase.slice(5)) : 0;
const url = (person: HeroPerson) => `/roster?view=roster&playerId=${encodeURIComponent(person.id)}`;
const trade = (p: HeroPerson) =>
  `/front-office/trade-hub?context=roster&playerId=${encodeURIComponent(p.id)}&partnerTeamAbbr=${encodeURIComponent(p.team ?? '')}`;
export function heroStandings(c: HeroContext) {
  const teams = Object.values(buildStandingsSnapshot(c.state, c.state.currentWeek));
  const own = teams.find((t) => t.abbr === c.team)!;
  if (!own)
    return {
      record: '0-0',
      context: 'Standings are taking shape',
      status: 'bubble' as const,
      remaining: 0,
    };
  const division = rankStandings(
    teams.filter((t) => t.conference === own.conference && t.division === own.division),
  );
  const seeds = buildPlayoffPicture(teams, own.conference);
  const seed = seeds.findIndex((t) => t.abbr === c.team) + 1;
  const remaining = c.state.games.filter(
    (g) => g.seasonType === 'REG' && !g.played && [g.homeTeam, g.awayTeam].includes(c.team),
  ).length;
  const maxWins = own.record.wins + own.record.ties / 2 + remaining;
  // Conservative elimination proof: cannot catch division leader AND at least seven
  // conference teams already exceed the best possible final win total.
  const ahead = teams.filter(
    (t) =>
      t.conference === own.conference &&
      t.abbr !== c.team &&
      t.record.wins + t.record.ties / 2 > maxWins,
  ).length;
  const eliminated = division[0].record.wins + division[0].record.ties / 2 > maxWins && ahead >= 7;
  return {
    record: `${own.record.wins}-${own.record.losses}${own.record.ties ? `-${own.record.ties}` : ''}`,
    context: seed
      ? `projected ${own.conference} seed #${seed}`
      : `No. ${division.findIndex((t) => t.abbr === c.team) + 1} in the ${own.conference} ${own.division}`,
    status: eliminated
      ? ('eliminated' as const)
      : seed
        ? ('contender' as const)
        : ('bubble' as const),
    remaining,
  };
}
function totals(c: HeroContext, id: string) {
  const lines = c.state.games
    .filter((g) => g.played && g.seasonType === 'REG')
    .flatMap(
      (g) => g.result?.playerStats.filter((p) => p.playerId === id && p.teamAbbr === c.team) ?? [],
    );
  const sum = (key: keyof SimulatedPlayerStat) =>
    lines.reduce((n, s) => n + (typeof s[key] === 'number' ? (s[key] as number) : 0), 0);
  return {
    games: lines.length,
    pass: sum('passingYards'),
    td: sum('passingTD'),
    ints: sum('interceptions'),
    rush: sum('rushingYards'),
    receive: sum('receivingYards'),
    scores: sum('rushingTD') + sum('receivingTD'),
    sacks: sum('sacks'),
    tackles: sum('tackles'),
    picks: sum('defensiveInterceptions'),
  };
}
export function buildHeroCandidates(c: HeroContext): HeroCandidate[] {
  const week = heroWeek(c.state),
    standing = heroStandings(c),
    history = Object.values(c.state.heroStories ?? {}).filter(
      (h) => h.season === c.state.season && h.week < week,
    );
  const candidates: HeroCandidate[] = [];
  const add = (
    id: string,
    category: string,
    headline: string,
    body: string,
    cta: string,
    href: string,
    weight = 50,
    person?: HeroPerson,
    visual: HeroStory['visualType'] = 'player',
    priority = 0,
    dialogue = false,
  ) => {
    if (person && !person.image) return;
    candidates.push({
      season: c.state.season,
      week,
      templateId: id,
      category,
      headline,
      body,
      cta,
      href,
      weight,
      priority,
      visualType: person || heroGraphic(visual) ? visual : 'stadium',
      image: person?.image || heroGraphic(visual)?.src || c.stadium,
      projectedPick: c.projectedPick,
      subjectId: person?.id,
      subjectName: person?.name,
      subjectDetail: person
        ? [person.position, person.rating ? `${person.rating} OVR` : null]
            .filter(Boolean)
            .join(' · ')
        : undefined,
      playerId: person && !['coach', 'prospect'].includes(visual) ? person.id : undefined,
      simulatedDialogue: dialogue || undefined,
    });
  };
  const schedule = '/front-office/league/schedule',
    standings = '/front-office/league/standings';
  if (week === 1) {
    add(
      'season-opening',
      'opening',
      'THE WAIT IS OVER',
      '“We’ve worked hard all offseason. We’re ready to hit somebody other than ourselves.” The preseason is behind you. Now the decisions start counting.',
      'VIEW WEEK 1',
      schedule,
      100,
      c.coach?.image ? c.coach : undefined,
      'coach',
      100,
      true,
    );
    return candidates;
  }
  const stats = c.players.map((p) => ({ p, s: totals(c, p.id) })).filter(({ s }) => s.games > 0);
  const strong = stats
    .filter(
      ({ p, s }) =>
        p.image &&
        ((s.pass / s.games >= 250 && s.td >= s.games * 2 && s.ints <= s.games) ||
          s.rush / s.games >= 75 ||
          s.receive / s.games >= 75 ||
          s.scores >= s.games ||
          s.sacks / s.games >= 0.8 ||
          s.picks >= 2),
    )
    .sort(
      (a, b) =>
        (b.s.pass + b.s.rush + b.s.receive) / b.s.games -
        (a.s.pass + a.s.rush + a.s.receive) / a.s.games,
    );
  const line = (s: ReturnType<typeof totals>) =>
    s.pass
      ? `${s.pass} passing yards · ${s.td} TD · ${s.ints} INT`
      : s.rush + s.receive
        ? `${s.rush} rushing yards · ${s.receive} receiving yards · ${s.scores} TD`
        : `${s.tackles} tackles · ${s.sacks} sacks · ${s.picks} INT`;
  const addDraftEnvironment = (late = false) => {
    const moved =
      c.projectedPick != null &&
      c.priorProjectedPick != null &&
      Math.abs(c.projectedPick - c.priorProjectedPick) >= 3;
    if (late && !moved) return;
    if (!c.projectedPick && !c.needs.length) return;
    add(
      'draft-environment',
      'draft',
      c.projectedPick ? 'YOUR DRAFT PICTURE IS TAKING SHAPE' : 'THE BOARD IS TAKING SHAPE',
      `${c.projectedPick ? `Your record-based projected draft position is #${c.projectedPick}. ` : ''}${moved ? `Previously projected #${c.priorProjectedPick}. ` : ''}${c.needs.length ? `Your biggest roster needs: ${c.needs.slice(0, 3).join(', ')}. Review how this class fits your roster.` : 'Review the draft board and your roster strategy.'}`,
      'VIEW DRAFT BOARD',
      '/front-office/draft',
      late ? 100 : 65,
      undefined,
      'draft',
      late ? 5 : 0,
    );
  };
  if (offseasonHeroPhases.includes(c.state.phase)) {
    return offseasonHeroCandidates(
      c,
      stats
        .filter(
          ({ p, s }) =>
            p.image &&
            ((s.pass >= 4000 && s.td >= 28 && s.ints <= 15) ||
              s.rush >= 1200 ||
              s.receive >= 1200 ||
              s.scores >= 12 ||
              s.sacks >= 12 ||
              s.picks >= 5),
        )
        .map(({ p, s }) => ({ p, summary: line(s) })),
      standing.record,
    );
  }
  if (week >= 15) {
    if (standing.status === 'eliminated') {
      addDraftEnvironment(true);
      add(
        'next-year',
        'future',
        'WHAT COMES NEXT?',
        `With the postseason out of reach, every decision now is about building a stronger ${c.state.season + 1} roster.`,
        'VIEW ROSTER PLAN',
        '/roster?view=roster',
        70,
      );
      for (const { p, s } of strong.filter((x) => (x.p.age ?? 99) <= 26))
        add(
          'young-core',
          'future-player',
          'THE FUTURE STARTS NOW',
          `The postseason is out of reach, but ${p.name} is one piece worth building around. ${line(s)}.`,
          'VIEW PLAYER',
          url(p),
          85,
          p,
        );
      for (const p of c.prospects.filter((p) => c.needs.includes(p.position ?? '')))
        add(
          'draft-picture',
          'draft',
          'YOUR DRAFT PICTURE IS TAKING SHAPE',
          `${p.name} projects in the #${p.low}–${p.high} range and could address your need at ${p.position}.`,
          'VIEW PROSPECT',
          `/front-office/draft/prospects/${p.id}`,
          95,
          p,
          'prospect',
          10,
        );
    } else {
      const headline =
        week === 18
          ? standing.status === 'contender'
            ? 'ONE MORE'
            : 'STILL IN THE RACE'
          : standing.status === 'bubble'
            ? 'NO ROOM FOR ERROR'
            : week === 17
              ? 'FINISH THE JOB'
              : 'EVERY GAME MATTERS NOW';
      add(
        `endgame-${week}-${standing.status}`,
        'playoffs',
        headline,
        `${standing.record} · ${standing.context}. ${standing.remaining} games remaining. ${standing.status === 'bubble' ? 'Wins and results elsewhere will shape the final playoff picture.' : 'Protect your position and finish the regular season strong.'}`,
        'VIEW PLAYOFF PICTURE',
        standings,
        80,
        week === 17 && c.coach?.image ? c.coach : undefined,
        'coach',
      );
      if (week === 16 && standing.status === 'contender')
        for (const { p, s } of strong)
          add(
            'built-for-moment',
            'playoff-player',
            'BUILT FOR THIS MOMENT',
            `${p.name} has delivered: ${line(s)}. Now your biggest games are here.`,
            'VIEW PLAYER',
            url(p),
            100,
            p,
            'player',
            10,
          );
    }
    return candidates;
  }
  const deadline = c.deadlineWeek,
    arc = week >= deadline - 3 && week <= deadline;
  if (arc) {
    const headings = [
      'THE TRADE MARKET IS OPENING UP',
      'A TARGET TO WATCH',
      'TRADE TALKS ARE HEATING UP',
      'THE DEADLINE IS HERE',
    ];
    const index = week - (deadline - 3);
    add(
      `trade-overview-${index}`,
      'trade',
      index === 3 ? 'THE DEADLINE IS HERE' : 'THE MARKET IS HEATING UP',
      `${standing.record} · ${standing.context}. ${index === 3 ? 'This is the final deadline week.' : 'Evaluate your options before the deadline.'} ${c.needs[0] ? `Your biggest roster need: ${c.needs[0]}.` : 'Review the market and protect your roster’s future.'}`,
      'VISIT TRADE CENTER',
      '/front-office/trade-hub',
      35,
      undefined,
      'trade-deadline',
    );
    for (const p of c.targets.filter((p) => index === 0 || c.needs.includes(p.position ?? '')))
      add(
        `trade-target-${index}`,
        'trade',
        index === 0 ? 'A NAME TO WATCH' : headings[index],
        `${p.name} · ${p.position} · ${p.rating} OVR is a plausible market target${c.needs.includes(p.position ?? '') ? ` at a position of need` : ''}. ${index === 3 ? 'Make your deadline decision.' : 'Review the fit and the asking price.'}`,
        'EXPLORE TRADE',
        trade(p),
        75,
        p,
        'trade-player',
        10,
      );
    for (const offer of c.offers) {
      const p = c.players.find((p) => p.id === offer.playerId);
      if (p)
        add(
          'phone-ringing',
          'trade',
          index === 3 ? 'THE DEADLINE IS HERE' : 'YOUR PHONE IS RINGING',
          `You have ${offer.count} active ${offer.count === 1 ? 'offer' : 'offers'} involving ${p.name}. Keep a key piece or see what he’s worth.`,
          'VIEW OFFERS',
          '/front-office/trade-hub',
          100,
          p,
          'player',
          20,
        );
    }
    // Week 6 is the final preferred development slot, only when no meaningful trade subject exists.
    if (week !== 6 || c.targets.some((p) => p.image)) return candidates;
  }
  if (!arc) {
    add(
      'division-check',
      'standings',
      week <= 5 ? 'SET THE TONE' : 'WHERE DO YOU STAND?',
      `At ${standing.record}, you’re ${standing.context}. ${week <= 5 ? 'A strong start can change the shape of your season.' : 'Assess your strengths before the stretch run.'}`,
      'VIEW STANDINGS',
      standings,
      40,
    );
    for (const { p, s } of strong) {
      add(
        p.position === 'QB' && week <= 5
          ? 'qb-hot-start'
          : week <= 5
            ? 'early-star'
            : 'star-season',
        'performance',
        p.position === 'QB' && week <= 5
          ? 'A STATEMENT TO START THE SEASON'
          : week <= 5
            ? 'SETTING THE PACE'
            : 'HE’S CARRYING THE LOAD',
        `${p.name}: ${line(s)}. ${week <= 5 ? 'A strong start is setting the tone.' : 'Your season is running through him.'}`,
        'VIEW PLAYER',
        url(p),
        75,
        p,
      );
      if ((p.rating ?? 99) < 85 && week <= 5)
        add(
          'breakout-watch',
          'breakout',
          'BREAKOUT WATCH',
          `${p.name} is outperforming his roster evaluation. ${line(s)}. His role is getting harder to ignore.`,
          'VIEW PLAYER',
          url(p),
          85,
          p,
        );
    }
    for (const p of c.freeAgents.filter(
      (p) => c.needs.includes(p.position ?? '') && (p.rating ?? 0) >= 72,
    ))
      add(
        'available-help',
        'free-agency',
        'HELP IS STILL OUT THERE',
        `${p.name} · ${p.position} · ${p.rating} OVR remains available at a position of need.`,
        'VIEW FREE AGENT',
        `/free-agents?playerId=${encodeURIComponent(p.id)}`,
        65,
        p,
        'free-agent',
      );
    if (week >= 10) {
      addDraftEnvironment();
      for (const p of c.players.filter((p) => (p.years ?? 99) <= 1 && (p.rating ?? 0) >= 80))
        add(
          'contract-decision',
          'contract',
          'A CONTRACT DECISION IS COMING',
          `${p.name} is a key roster piece with ${p.years} year remaining. Plan for his next contract before the offseason.`,
          'VIEW CONTRACT',
          '/front-office/contracts',
          70,
          p,
        );
      for (const p of c.prospects.filter((p) => c.needs.includes(p.position ?? ''))) {
        const rising = p.rank < p.priorRank;
        add(
          rising ? 'draft-riser' : 'prospect-watch',
          'draft',
          rising ? 'CLIMBING DRAFT BOARDS' : 'A PROSPECT TO REMEMBER',
          `${p.name} · ${p.position} · ${p.school ?? 'Draft prospect'}. ${rising ? `Up from #${p.priorRank} to #${p.rank} on your simulated scouting board.` : `Projected range: #${p.low}–${p.high}.`} He fits a roster need.`,
          'VIEW PROSPECT',
          `/front-office/draft/prospects/${p.id}`,
          week <= 13 ? 80 : 55,
          p,
          'prospect',
        );
      }
      if (c.coach?.image)
        add(
          'coach-check',
          'coach',
          'THE MESSAGE IS CLEAR',
          `At ${standing.record}, your team enters the stretch run as ${standing.context}. Review what needs to improve.`,
          'VIEW SEASON OUTLOOK',
          standings,
          55,
          c.coach,
          'coach',
        );
    }
    if (c.ownership) {
      add(
        'home-field',
        'ownership',
        'HOME FIELD MATTERS',
        `Attendance is at ${Math.round(c.ownership.attendance)}% capacity. See how the business side of your franchise is performing.`,
        'VIEW OWNERSHIP',
        '/front-office/ownership',
        45,
      );
      if (week >= 10 && !history.some((h) => h.category === 'facility')) {
        const facility = (c.ownership.facilities ?? [])
          .filter((f) => f.score < 74 && f.upgradeAvailable)
          .sort((a, b) => a.score - b.score || a.visual.localeCompare(b.visual))[0];
        if (facility) {
          const injuries = c.injuries?.length ?? 0;
          const headlines = {
            'locker-room': 'THE PLAYERS HAVE SPOKEN',
            'training-room': injuries ? 'RECOVERY IS BECOMING A CONCERN' : 'INVEST IN PLAYER CARE',
            'weight-room': 'PLAYERS WANT MORE',
            cafeteria:
              facility.score < 68
                ? 'NUTRITION GETS LOW MARKS'
                : 'MORE THAN WHAT HAPPENS ON SUNDAYS',
          };
          add(
            `facility-${facility.visual}`,
            'facility',
            headlines[facility.visual],
            `Your ${facility.name} received a ${facility.grade} on the ownership report card. ${facility.visual === 'training-room' && injuries ? `With ${injuries} players on injured reserve, review your recovery resources. ` : ''}Explore an investment in the day-to-day player experience.`,
            'EXPLORE OPTIONS',
            `/front-office/ownership/facilities#${facility.projectId}`,
            (week <= 13 ? 85 : 55) + (74 - facility.score),
            undefined,
            facility.visual,
          );
        }
      }
    }
    for (const injury of c.injuries ?? []) {
      const p = c.players.find((p) => p.id === injury.playerId);
      if (p)
        add(
          'injury-response',
          'injury',
          'NEXT MAN UP',
          `${p.name}: ${injury.detail}. Review your depth before the next game.`,
          'VIEW ROSTER',
          '/roster?view=roster',
          90,
          p,
        );
    }
  }
  if (
    week >= 4 &&
    week <= 14 &&
    !history.some((h) => h.category === 'development') &&
    !c.state.heroDevelopmentSeasons?.includes(c.state.season)
  ) {
    for (const { p, s } of strong.filter((x) => (x.p.age ?? 99) <= 27))
      add(
        'new-core',
        'development',
        'A NEW CORE PIECE IS EMERGING',
        `${p.name} is trending up after a strong start. ${line(s)}. His role in your future may be getting bigger.`,
        'VIEW DEVELOPMENT',
        '/front-office/development',
        120,
        p,
        'player',
        week <= 6 ? 20 : 10,
      );
  }
  return candidates;
}
/** Ignore cache-busting parameters when comparing the underlying artwork. */
export function heroImageIdentity(image: string) {
  return image.split(/[?#]/)[0];
}

export function previousWeeklyHero(state: FranchiseSimulationState) {
  const week = heroWeek(state);
  return [...(state.heroHistory ?? []), ...Object.values(state.heroStories ?? {})]
    .filter((h) => h.season === state.season && h.week > 0 && h.week < week)
    .sort((a, b) => b.week - a.week)[0];
}

export function selectHeroStory(c: HeroContext): HeroStory | null {
  const week = heroWeek(c.state);
  const offseason = offseasonHeroPhases.includes(c.state.phase);
  if (!offseason && (week < 1 || week > 18)) return null;
  const candidates = buildHeroCandidates(c);
  if (!candidates.length) return null;
  const history = [
    ...(c.state.heroHistory ?? []),
    ...Object.values(c.state.heroStories ?? {}),
  ].filter((h) => h.season === c.state.season && (offseason || h.week < week));
  if (offseason) history.reverse();
  else history.sort((a, b) => b.week - a.week);
  // A weight penalty still allowed the highest-priority image to win repeatedly.
  // Enforce image diversity before scoring for weekly stories; offseason action
  // celebrations keep their existing priority and persistence behavior.
  const previous = !offseason ? previousWeeklyHero(c.state) : undefined;
  let eligible = previous
    ? candidates.filter(
        (candidate) => heroImageIdentity(candidate.image) !== heroImageIdentity(previous.image),
      )
    : candidates;
  if (!eligible.length && previous) {
    const useStadium = heroImageIdentity(previous.image) !== heroImageIdentity(c.stadium);
    // Keep the relevant weekly story/CTA when a sparse candidate pool has only
    // one image; alternate neutral setting artwork instead of inventing news.
    const base = [...candidates].sort((a, b) => b.priority - a.priority || b.weight - a.weight)[0];
    eligible = [
      {
        ...base,
        visualType: useStadium ? 'stadium' : 'locker-room',
        image: useStadium ? c.stadium : heroGraphic('locker-room').src,
      },
    ];
  }

  const scored = eligible
    .map((candidate) => {
      let weight = candidate.weight;
      if (
        history
          .slice(0, 3)
          .some((h) => heroImageIdentity(h.image) === heroImageIdentity(candidate.image))
      )
        weight *= 0.2;
      if (
        history.slice(0, 3).some((h) => h.category === candidate.category) &&
        candidate.category !== 'trade' &&
        !(candidate.visualType === 'prospect' && history[0]?.visualType === 'draft')
      )
        weight *= 0.3;
      if (
        history.slice(0, 2).every((h) => h.subjectId === candidate.subjectId) &&
        history.length >= 2 &&
        candidate.subjectId
      )
        weight *= 0.1;
      if (history[0]?.visualType === candidate.visualType)
        weight *= candidate.visualType === 'draft' ? 0.05 : 0.7;
      if (history.slice(0, 3).some((h) => h.templateId === candidate.templateId)) weight *= 0.5;
      return { ...candidate, weight };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        b.weight - a.weight ||
        a.templateId.localeCompare(b.templateId) ||
        (a.subjectId ?? '').localeCompare(b.subjectId ?? ''),
    );
  const shortlist = scored
    .filter((x) => x.priority === scored[0].priority && x.weight >= scored[0].weight * 0.6)
    .slice(0, 6);
  let pick =
    (hash(`${c.state.seed}:${c.state.season}:${offseason ? c.state.phase : week}:hero-v1`) /
      4294967296) *
    shortlist.reduce((s, c) => s + c.weight, 0);
  let selected = shortlist[0];
  for (const candidate of shortlist) {
    pick -= candidate.weight;
    if (pick <= 0) {
      selected = candidate;
      break;
    }
  }
  const { weight, priority, ...story } = selected;
  return story;
}

export function heroStoryKey(state: FranchiseSimulationState) {
  return `${state.season}:${offseasonHeroPhases.includes(state.phase) ? state.phase : heroWeek(state)}`;
}

export function heroStoryLabel(story: HeroStory) {
  const phases: Record<string, string> = {
    offseason: 'Offseason',
    resign_cut: 'Re-sign Players',
    scouting_combine: 'Scouting Combine',
    free_agency: 'Tampering Window',
    free_agency_open: 'Free Agency',
    draft: 'NFL Draft',
  };
  return story.phase ? (phases[story.phase] ?? 'Offseason') : `Week ${story.week}`;
}
