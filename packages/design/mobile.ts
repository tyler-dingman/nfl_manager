/** Shared visual contract; render with DOM on web and native views in the apps. */
export const editorialDesign = {
  background: '#001222',
  foreground: '#FFFFFF',
  muted: '#A8BAC4',
  border: '#183743',
  page: '#F4F6F8',
  navigation: '#091A20',
} as const;
export const primaryDestinations = [
  { label: 'Home', web: '/', native: '/', icon: 'home' },
  { label: 'The Beat', web: '/the-beat', native: '/wire', icon: 'newspaper' },
  { label: 'Film Room', web: '/watch', native: '/film-room', icon: 'play-circle' },
  { label: 'Front Office', web: '/front-office', native: '/front-office', icon: 'briefcase' },
  { label: 'Parlay Lab', web: '/parlay-lab', native: '/parlay-lab', icon: 'git-network' },
  { label: 'Account', web: '/account', native: '/account', icon: 'person' },
] as const;
