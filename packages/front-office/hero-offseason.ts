import { heroGraphic } from './hero-assets';
import type { HeroContext, HeroPerson, HeroStory, HeroCandidate } from './hero-story';
import type { DraftSessionDTO } from '../../src/types/draft';

export const offseasonHeroPhases = [
  'offseason',
  'resign_cut',
  'scouting_combine',
  'free_agency',
  'free_agency_open',
  'draft',
];
export type OffseasonHeroContext = {
  capSpace: number;
  pending: HeroPerson[];
  picks: number[];
  pickCount?: number;
  teamName: string;
  city: string;
  outcome: string;
  champion: boolean;
  madePlayoffs: boolean;
  deepRun: boolean;
  draft?: DraftSessionDTO;
  /** Actual recorded transaction, never inferred from a player merely being on the roster. */
  action?: {
    id: string;
    type: 'signing' | 're-sign';
    player: HeroPerson;
    years: number;
    total: number;
  };
};
const money = (n: number) => `$${Math.abs(n).toFixed(1)}M`;
const playerHref = (p: HeroPerson) => `/roster?view=roster&playerId=${encodeURIComponent(p.id)}`;
export function offseasonHeroCandidates(
  c: HeroContext,
  seasonStats: Array<{ p: HeroPerson; summary: string }>,
  record: string,
): HeroCandidate[] {
  const o = c.offseason;
  if (!o) return [];
  const phase = c.state.phase;
  const candidates: HeroCandidate[] = [];
  const add = (
    id: string,
    headline: string,
    body: string,
    cta: string,
    href: string,
    weight = 60,
    person?: HeroPerson,
    visual: HeroStory['visualType'] = 'player',
    priority = 0,
    postActionId?: string,
  ) => {
    if (person && !person.image) return;
    candidates.push({
      season: c.state.season,
      week: 0,
      phase,
      templateId: id,
      category: id,
      visualType: person || heroGraphic(visual) ? visual : 'stadium',
      image: person?.image || heroGraphic(visual)?.src || c.stadium,
      subjectId: person?.id,
      subjectName: person?.name,
      subjectDetail: person
        ? [person.position, person.rating ? `${person.rating} OVR` : undefined]
            .filter(Boolean)
            .join(' · ')
        : undefined,
      playerId: person && !['coach', 'prospect'].includes(visual) ? person.id : undefined,
      headline,
      body,
      cta,
      href,
      weight,
      priority,
      postActionId,
    });
  };
  const needs = c.needs.slice(0, 3).join(', ');
  const cap =
    o.capSpace < 0 ? `${money(o.capSpace)} over the cap` : `${money(o.capSpace)} in cap space`;
  const action = o.action;
  if (action && !c.state.heroAcknowledgements?.includes(action.id)) {
    add(
      `success-${action.type}`,
      action.type === 're-sign' ? "HE'S STAYING HOME" : `WELCOME TO ${o.city.toUpperCase()}`,
      `${action.player.name} is ${action.type === 'signing' ? 'joining' : 'staying in'} ${o.city}. You've agreed to a ${action.years}-year · ${money(action.total)} ${action.type === 're-sign' ? 'extension' : 'deal'}.`,
      action.type === 're-sign' ? 'VIEW CONTRACT' : 'VIEW YOUR NEWEST PLAYER',
      action.type === 're-sign' ? '/front-office/contracts' : playerHref(action.player),
      100,
      action.player,
      'player',
      80,
      action.id,
    );
  }
  if (phase === 'offseason') {
    if (o.champion) {
      const person = seasonStats[0]?.p ?? c.coach;
      add(
        'champions',
        'CHAMPIONS',
        `You finished the job. ${o.teamName} ends the regular season ${record} and brings home a championship. Now the challenge becomes building a team that can do it again.`,
        'REVIEW CHAMPIONSHIP SEASON',
        '/front-office/league/schedule',
        100,
        person,
        person === c.coach ? 'coach' : 'player',
        100,
      );
      // Missing headshots must never hide a championship.
      if (!candidates.length)
        add(
          'champions',
          'CHAMPIONS',
          `${o.teamName} finished ${record} in the regular season and won the Super Bowl. Now build a team that can do it again.`,
          'REVIEW CHAMPIONSHIP SEASON',
          '/front-office/league/schedule',
          100,
          undefined,
          'stadium',
          100,
        );
      return candidates;
    }
    add(
      'season-verdict',
      'THE VERDICT IS IN',
      `You finished ${record} and ${o.outcome}. Now comes the part that determines what happens next.`,
      'REVIEW YOUR SEASON',
      '/front-office/league/schedule',
      o.deepRun ? 100 : 65,
      c.coach?.image ? c.coach : undefined,
      'coach',
    );
    for (const { p, summary } of seasonStats)
      add(
        'season-star',
        'A SEASON TO REMEMBER',
        `${p.name} finished the year with ${summary}. He established himself as one of the pillars of your franchise.`,
        'VIEW PLAYER',
        playerHref(p),
        o.deepRun ? 100 : 70,
        p,
      );
    add(
      'offseason-plan',
      o.madePlayoffs ? 'WHAT COMES NEXT?' : 'THE WORK STARTS NOW',
      `The season ends at ${record}; you ${o.outcome}. You enter the offseason with ${cap}, ${o.pending.length} pending free agents and ${o.pickCount ?? o.picks.length} draft picks.${o.picks[0] ? ` Your first selection is #${o.picks[0]}.` : ''} Time to build what's next.`,
      'VIEW OFFSEASON PLAN',
      '/roster?view=resign',
      o.madePlayoffs ? 55 : 100,
    );
    const facility = c.ownership?.facilities
      ?.filter((f) => f.score < 68 && f.upgradeAvailable)
      .sort((a, b) => a.score - b.score)[0];
    if (facility)
      add(
        'offseason-facility',
        'BUILD MORE THAN A ROSTER',
        `${facility.name} remains one of your lowest-rated player experiences at ${facility.grade}. The offseason gives ownership a chance to invest.`,
        'VIEW OWNERSHIP',
        `/front-office/ownership/facilities#${facility.projectId}`,
        o.madePlayoffs ? 50 : 90,
        undefined,
        facility.visual,
      );
  } else if (phase === 'resign_cut') {
    for (const p of o.pending.filter((p) => (p.rating ?? 0) >= 75)) {
      const weight = 65 + ((p.rating ?? 75) - 75) + (c.needs.includes(p.position ?? '') ? 10 : 0);
      if (p.ask != null)
        add(
          'keep-him',
          'CAN YOU KEEP HIM?',
          `${p.name} · ${p.position} · ${p.rating} OVR is set to hit free agency. His estimated market value is approximately ${money(p.ask)} per year.`,
          'START NEGOTIATIONS',
          `/roster?view=resign&openNegotiation=1&playerId=${encodeURIComponent(p.id)}`,
          weight,
          p,
        );
      add(
        'stays-goes',
        'WHO STAYS? WHO GOES?',
        `You have ${o.pending.length} players headed toward free agency and ${cap}. ${p.name} headlines your biggest decisions.`,
        'RE-SIGN PLAYERS',
        `/roster?view=resign&openNegotiation=1&playerId=${encodeURIComponent(p.id)}`,
        weight,
        p,
      );
    }
    if (o.capSpace < 5) {
      for (const p of [...c.players]
        .filter((p) => p.capHit != null)
        .sort((a, b) => b.capHit! - a.capHit!)
        .slice(0, 3))
        add(
          'cap-pressure',
          'SOMETHING HAS TO GIVE',
          `You're ${cap} with major decisions ahead. ${p.name} carries a ${money(p.capHit!)} cap number. Review your options.`,
          'MANAGE THE CAP',
          '/front-office/contracts',
          o.capSpace < 0 ? 115 : 80,
          p,
        );
    }
    add(
      'resign-plan',
      o.pending.length ? 'WHO STAYS? WHO GOES?' : 'YOUR CORE IS IN PLACE',
      `${o.pending.length} pending free agents · ${cap}. Review your contracts before the Combine.`,
      'RE-SIGN PLAYERS',
      '/roster?view=resign',
      35,
    );
  } else if (phase === 'scouting_combine') {
    // No simulated combine results are recorded yet. Rankings alone are not combine performance.
    add(
      'combine-evaluation',
      'THE EVALUATION STARTS NOW',
      `The Combine is underway.${needs ? ` Your scouts are focused on ${needs}.` : ' Review the incoming class and your scouting board.'} Evaluate the next generation of your roster.`,
      'VIEW COMBINE',
      '/front-office/draft/prospects',
      75,
      undefined,
      'combine',
    );
  } else if (phase === 'free_agency' || phase === 'free_agency_open') {
    for (const p of c.freeAgents.filter((p) => (p.rating ?? 0) >= 75)) {
      const fit = c.needs.includes(p.position ?? '');
      const affordable = p.ask == null || p.ask <= Math.max(0, o.capSpace);
      const weight = 45 + ((p.rating ?? 75) - 75) * 2 + (fit ? 25 : 0) + (affordable ? 15 : -25);
      if (fit)
        add(
          'fa-fit',
          'THE FIT IS OBVIOUS',
          `You entered free agency needing help at ${p.position}. ${p.name} · ${p.rating} OVR is among the available options.${p.ask != null ? ` His current asking price is approximately ${money(p.ask)} per year.` : ''}`,
          'VIEW FREE AGENT',
          `/free-agents?playerId=${encodeURIComponent(p.id)}`,
          weight,
          p,
          'free-agent',
        );
      // The superlative is reserved for the actual highest-rated available player.
      if (p.rating === Math.max(...c.freeAgents.map((p) => p.rating ?? 0)))
        add(
          'fa-market-leader',
          'THE BIGGEST NAME ON THE MARKET',
          `${p.name} · ${p.position} · ${p.rating} OVR is available.${p.ask != null ? ` He's expected to command around ${money(p.ask)} per year.` : ''} Review the fit before making an offer.`,
          'MAKE AN OFFER',
          `/free-agents?openOffer=1&playerId=${encodeURIComponent(p.id)}`,
          weight,
          p,
          'free-agent',
        );
    }
    add(
      'fa-patience',
      'PATIENCE OR PRESSURE?',
      `You have ${cap} and ${c.needs.length} roster needs to address. Explore the available market and choose your next move.`,
      'EXPLORE FREE AGENTS',
      '/free-agents',
      45,
    );
  } else if (phase === 'draft') {
    const session = o.draft;
    const pick =
      session?.status === 'in_progress' ? session.picks[session.currentPickIndex] : undefined;
    const selected = new Set(session?.picks.map((p) => p.selectedPlayerId).filter(Boolean));
    const available = c.prospects.filter((p) => !selected.has(p.id));
    const top = [...c.prospects].sort((a, b) => a.rank - b.rank).slice(0, 10);
    const room = '/front-office/draft/room?mode=real';
    if (pick?.ownerTeamAbbr === c.team && !pick.selectedPlayerId)
      add(
        'on-clock',
        "YOU'RE ON THE CLOCK",
        `Pick #${pick.overall} is yours. ${top.filter((p) => !selected.has(p.id)).length} of your top ${top.length} ranked prospects are still available.`,
        'MAKE YOUR PICK',
        room,
        100,
        undefined,
        'draft',
        100,
      );
    const offer = session?.tradeState?.offers.find(
      (offer) =>
        offer.status === 'active' &&
        offer.send.some((id) =>
          session.picks.some(
            (p) => p.id === id && p.ownerTeamAbbr === c.team && !p.selectedPlayerId,
          ),
        ),
    );
    if (offer && session) {
      const labels = [
        ...session.picks.map((p) => ({ id: p.id, label: `Pick #${p.overall}` })),
        ...(session.tradeState?.futurePicks ?? []).map((p) => ({
          id: p.id,
          label: `${p.year} Round ${p.round}`,
        })),
      ];
      add(
        'draft-offer',
        'YOUR PHONE IS RINGING',
        `${offer.team} has offered ${offer.receive
          .map((id) => labels.find((p) => p.id === id)?.label)
          .filter(Boolean)
          .join(', ')} for ${offer.send
          .map((id) => labels.find((p) => p.id === id)?.label)
          .filter(Boolean)
          .join(', ')}. Review the proposal.`,
        'VIEW OFFER',
        room,
        100,
        undefined,
        'draft',
        90,
      );
    }
    if (session?.status !== 'completed') {
      for (const p of available) {
        if (pick && pick.overall > p.high + 5)
          add(
            'draft-fall',
            "HE'S STILL THERE",
            `${p.name} was projected in the #${p.low}–${p.high} range. It's Pick #${pick.overall} and he's still on the board.`,
            'VIEW PROSPECT',
            `/front-office/draft/prospects/${p.id}`,
            90,
            p,
            'prospect',
            70,
          );
        const next =
          session?.picks.find(
            (p, i) =>
              i >= session.currentPickIndex && p.ownerTeamAbbr === c.team && !p.selectedPlayerId,
          )?.overall ?? o.picks[0];
        if (next && c.needs.includes(p.position ?? '') && p.low <= next + 8 && p.high >= next - 8)
          add(
            'draft-target',
            `WILL HE MAKE IT TO #${next}?`,
            `${p.name} · ${p.position} · ${p.school ?? 'Draft prospect'} fits a roster need and projects in the #${p.low}–${p.high} range. Your next selection is #${next}.`,
            'VIEW PROSPECT',
            `/front-office/draft/prospects/${p.id}`,
            75,
            p,
            'prospect',
            60,
          );
      }
    }
    const last = session?.picks
      .filter((p) => p.selectedByTeamAbbr === c.team && p.selectedPlayerId)
      .at(-1);
    const newPlayer = last && session?.prospects.find((p) => p.id === last.selectedPlayerId);
    const actionId = last && `${c.state.season}:draft:${session?.id}:${last.id}`;
    if (last && newPlayer && actionId && !c.state.heroAcknowledgements?.includes(actionId))
      add(
        'draft-welcome',
        `WELCOME TO ${o.teamName.toUpperCase()}`,
        `With Pick #${last.overall}, you selected ${newPlayer.firstName} ${newPlayer.lastName} · ${newPlayer.position}${newPlayer.school ? ` · ${newPlayer.school}` : ''}.${last.grade ? ` Selection grade: ${last.grade}.` : ''}`,
        'VIEW DRAFT PICK',
        room,
        100,
        {
          id: newPlayer.id,
          name: `${newPlayer.firstName} ${newPlayer.lastName}`,
          position: newPlayer.position,
          image: newPlayer.headshotUrl,
        },
        'prospect',
        50,
        actionId,
      );
    add(
      'draft-board',
      session?.status === 'completed' ? 'YOUR CLASS IS COMPLETE' : 'THE BOARD IS TAKING SHAPE',
      session?.status === 'completed'
        ? 'Your draft is complete. Review the class, then begin the new season.'
        : `${needs ? `Your top roster needs: ${needs}. ` : ''}Review your board and prepare for your next selection.`,
      'VIEW DRAFT',
      '/front-office/draft',
      40,
      undefined,
      'draft',
    );
  }
  return candidates;
}
