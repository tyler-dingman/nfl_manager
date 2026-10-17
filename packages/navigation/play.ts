/** Shared destinations; web and native render their own navigation controls. */
export const PLAY_EXPERIENCES = [
  { id: 'trivia', label: 'Trivia', href: '/trivia', nativeHref: '/trivia' },
] as const;

export const isPlayPath = (path: string | null) =>
  !!path &&
  (path === '/play' ||
    path.startsWith('/play/') ||
    path === '/trivia-game' ||
    PLAY_EXPERIENCES.some((item) => path === item.href || path.startsWith(`${item.href}/`)));
