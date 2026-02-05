export type LeaguePhase = 'Offseason' | 'FreeAgency' | 'Draft';

const PHASE_ALIASES: Record<string, LeaguePhase> = {
  offseason: 'Offseason',
  Offseason: 'Offseason',
  free_agency: 'FreeAgency',
  freeagency: 'FreeAgency',
  FreeAgency: 'FreeAgency',
  draft: 'Draft',
  Draft: 'Draft',
};

export const normalizePhase = (phase?: string | null): LeaguePhase =>
  PHASE_ALIASES[phase ?? ''] ?? 'Offseason';
