/** Supplied originals, shared by web and native. Focal positions are presentation only. */
export const frontOfficeHeroAssets = {
  combine: {
    src: '/assets/front-office-hero-assets/combine.png',
    label: 'Scouting Combine',
    desktopPosition: '50% 55%',
    mobilePosition: '55% 55%',
  },
  'locker-room': {
    src: '/assets/front-office-hero-assets/locker-room.png',
    label: 'Locker room',
    desktopPosition: '50% 50%',
    mobilePosition: '50% 50%',
  },
  'training-room': {
    src: '/assets/front-office-hero-assets/training-room.png',
    label: 'Training room',
    desktopPosition: '50% 55%',
    mobilePosition: '45% 55%',
  },
  'weight-room': {
    src: '/assets/front-office-hero-assets/weight-room.png',
    label: 'Weight room',
    desktopPosition: '50% 50%',
    mobilePosition: '45% 50%',
  },
  cafeteria: {
    src: '/assets/front-office-hero-assets/team-cafeteria.png',
    label: 'Team cafeteria',
    desktopPosition: '60% 50%',
    mobilePosition: '60% 50%',
  },
  'trade-deadline': {
    src: '/assets/front-office-hero-assets/trade-deadline.png',
    label: 'Trade deadline',
    desktopPosition: '50% 50%',
    mobilePosition: '60% 50%',
  },
  draft: {
    src: '/assets/front-office-hero-assets/draft.png',
    label: 'Draft stage',
    desktopPosition: '50% 45%',
    mobilePosition: '50% 45%',
  },
} as const;
export type HeroGraphic = keyof typeof frontOfficeHeroAssets;
export function heroGraphic(type: string) {
  return frontOfficeHeroAssets[type as HeroGraphic];
}
export type HeroFacility = {
  visual: Extract<HeroGraphic, 'locker-room' | 'training-room' | 'weight-room' | 'cafeteria'>;
  name: string;
  grade: string;
  score: number;
  projectId: string;
  upgradeAvailable: boolean;
};

/** Stadium focal points are presentation-only; story selection still owns the image URL. */
export const heroStadiumPositions: Record<
  string,
  { desktopPosition: string; mobilePosition: string }
> = {
  KC: { desktopPosition: '70% 50%', mobilePosition: '65% 50%' },
};
export function heroBackgroundPosition(type: string, team: string) {
  return (
    heroGraphic(type) ??
    heroStadiumPositions[team] ?? {
      desktopPosition: '65% 50%',
      mobilePosition: '60% 50%',
    }
  );
}

/** Original facility artwork has 1–4px white framing. Overscan only those
 * backgrounds so the hero clips the frame on every aspect ratio. */
export function heroBackgroundScale(type: string): number {
  return [
    'locker-room',
    'training-room',
    'weight-room',
    'cafeteria',
    'trade-deadline',
    'draft',
  ].includes(type)
    ? 1.03
    : 1;
}
