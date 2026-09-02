export const INTENSITIES = ['CASUAL', 'LOCKED_IN', 'SICKO'] as const;
export const LANDING_EXPERIENCES = [
  'HOME',
  'HUDDLE',
  'THREE_AND_OUT',
  'WATCH',
  'WIRE',
  'FRONT_OFFICE',
] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const DEFAULT_PREFERENCES = {
  preferredTeamId: null,
  audioPlaybackSpeed: 1,
  autoplayVideo: false,
  reducedMotion: false,
  showAroundLeague: true,
  preferredLandingExperience: 'HOME',
  pushEnabled: true,
  smsEnabled: false,
  emailEnabled: true,
  showPollResultsBeforeVoting: false,
  predictionVisibility: 'PRIVATE',
  intensity: 'LOCKED_IN',
  advancedNotifications: {},
} as const;
