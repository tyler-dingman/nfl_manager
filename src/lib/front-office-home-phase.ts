import { frontOfficeLifecycle, normalizeFrontOfficePhase } from './front-office-phase';

export function frontOfficeHomePhase(phase: string) {
  const current = normalizeFrontOfficePhase(phase);
  const lifecycle = frontOfficeLifecycle(current);
  if (current === 'scouting_combine')
    return {
      kind: 'combine' as const,
      eyebrow: 'Offseason · Scouting Combine',
      title: 'Scouting\nCombine',
      summary:
        'The offseason starts here. Evaluate the incoming draft class, review scouting reports, and begin shaping your draft board.',
      cta: 'View Combine Prospects',
      href: '/front-office/draft/prospects',
    };
  if (lifecycle.offseasonStage === 'FREE_AGENCY')
    return {
      kind: 'free-agency' as const,
      eyebrow: 'Offseason · Free Agency',
      title: 'Free\nAgency',
      summary:
        'Build the roster for next season. Target available players, manage your cap, and fill your biggest roster needs.',
      cta: 'View Free Agents',
      href: '/free-agents',
    };
  if (current === 'draft')
    return {
      kind: 'draft' as const,
      eyebrow: 'Offseason · NFL Draft',
      title: 'The NFL\nDraft',
      summary:
        'The future of your franchise is on the clock. Use your draft capital, scouting reports, team needs, and big board to build the next generation of the roster.',
      cta: 'Enter Draft Central',
      href: '/front-office/draft',
    };
  return {
    kind: lifecycle.mainPhase === 'PLAYOFFS' ? ('playoffs' as const) : ('season' as const),
    eyebrow: lifecycle.mainPhase === 'PLAYOFFS' ? 'Playoff Focus' : 'Weekly Focus',
    title:
      lifecycle.mainPhase === 'PLAYOFFS'
        ? 'Focus: Win\nand advance'
        : 'Focus: Build\nfor the long term',
    summary: '',
    cta: 'View Weekly Brief',
    href: '',
  };
}
