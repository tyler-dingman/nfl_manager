import { resolveCollegeBrandTheme } from '@/lib/college-brand-themes';

export const STORY_TEMPLATE_ASSETS = {
  'rising-prospect': ['arrow-up', 'bars-ascending', 'diagonal-slashes'],
  'falling-prospect': ['arrow-down', 'bars-descending', 'diagonal-slashes'],
  'top-prospect': ['target', 'corner-brackets'],
  'draft-stock': ['minus'],
  'combine-pro-day': ['stopwatch', 'measurement-grid'],
  'injury-update': ['medical-cross'],
  'team-visit': ['map-pin', 'visit-route'],
  'scouting-report': ['clipboard', 'accent-rule'],
  'position-battle': ['versus', 'diagonal-slashes'],
  'draft-declaration': ['declaration-card', 'checkmark'],
  transfer: ['transfer-arrows', 'visit-route'],
  'award-recognition': ['trophy', 'star'],
  'record-milestone': ['milestone-marker', 'burst'],
  'mock-draft-projection': ['draft-card', 'draft-shield'],
  'best-fit': ['puzzle', 'target'],
  'draft-buzz': ['signal', 'radar'],
  trade: ['transfer-arrows', 'arrow-right'],
  contract: ['declaration-card', 'handshake'],
  injury: ['medical-cross', 'status-dot'],
  signing: ['plus', 'checkmark'],
  release: ['minus', 'return-arrow'],
  roster: ['clipboard', 'plus'],
  transaction: ['transfer-arrows', 'clipboard'],
  rumor: ['signal', 'radar'],
  draft: ['draft-card', 'target'],
  game: ['versus', 'football'],
  analysis: ['bars-ascending', 'playbook-marks'],
  other: ['football', 'playbook-marks'],
  generic: ['football', 'playbook-marks'],
} as const;

export type StoryGraphicTemplate = keyof typeof STORY_TEMPLATE_ASSETS;
export type StoryGraphicSize = 'hero' | 'card' | 'compact' | 'article';
export type StoryIdentity = {
  id?: string | null;
  displayName: string;
  primary?: string | null;
  secondary?: string | null;
  logoUrl?: string | null;
};
export type StoryMetric = { label: string; value: string; unit?: string };
export type FrontOfficeStoryGraphicModel = {
  id: string;
  template: StoryGraphicTemplate;
  headline: string;
  eyebrow?: string;
  summary?: string;
  primaryIdentity?: StoryIdentity;
  secondaryIdentity?: StoryIdentity;
  metrics?: StoryMetric[];
  previousRank?: number;
  currentRank?: number;
  status?: string;
  source?: string;
  dateLabel?: string;
};

const validRank = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;

export function comparableRankDirection(previousRank?: number, currentRank?: number) {
  if (!validRank(previousRank) || !validRank(currentRank)) return null;
  const movement = previousRank - currentRank;
  return { movement, direction: movement > 0 ? 'up' : movement < 0 ? 'down' : 'steady' } as const;
}

export function normalizeStoryTemplate(template: string): StoryGraphicTemplate {
  return template in STORY_TEMPLATE_ASSETS ? (template as StoryGraphicTemplate) : 'generic';
}

export function adaptDraftNewsGraphic(input: {
  id: string;
  headline: string;
  summary?: string;
  category?: string;
  prospectName?: string | null;
  school?: string | null;
  schoolLogo?: string | null;
  schoolPrimary?: string | null;
  previousRank?: number;
  currentRank?: number;
  source?: string;
  dateLabel?: string;
}): FrontOfficeStoryGraphicModel {
  const schoolTheme = input.school ? resolveCollegeBrandTheme(input.school) : null;
  const rank = comparableRankDirection(input.previousRank, input.currentRank);
  const template =
    rank?.direction === 'up'
      ? 'rising-prospect'
      : rank?.direction === 'down'
        ? 'falling-prospect'
        : rank?.direction === 'steady'
          ? 'draft-stock'
          : 'generic';
  return {
    id: input.id,
    template,
    headline: input.headline,
    eyebrow: input.category,
    summary: input.summary,
    primaryIdentity: input.school
      ? {
          id: input.school,
          displayName: input.school,
          logoUrl: input.schoolLogo,
          primary: input.schoolPrimary ?? schoolTheme?.primary,
          secondary: schoolTheme?.secondary,
        }
      : input.prospectName
        ? { displayName: input.prospectName }
        : undefined,
    previousRank: rank ? input.previousRank : undefined,
    currentRank: rank ? input.currentRank : undefined,
    source: input.source,
    dateLabel: input.dateLabel,
  };
}
