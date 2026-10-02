import type { Href } from 'expo-router';

/** Map product links to native routes without opening the mobile website. */
export function nativeDestination(value: string | null | undefined): Href | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  const url = new URL(value, 'https://downanddistance.local');
  const path = url.pathname;
  if (path === '/huddle') return { pathname: '/huddle', params: Object.fromEntries(url.searchParams) } as Href;
  if (path === '/the-beat' || path === '/wire') {
    const id = url.searchParams.get('story');
    return id ? { pathname: '/beat-story/[id]', params: { id } } : '/beat';
  }
  if (path.startsWith('/content/'))
    return { pathname: '/story/[id]', params: { id: decodeURIComponent(path.slice(9)) } };
  if (path === '/watch' || path.startsWith('/watch/')) return '/film-room';
  const routes = [
    '/crew',
    '/game-day',
    '/trivia',
    '/front-office',
    '/parlay-lab',
    '/account',
    '/rewards',
    '/catch-up',
    '/merch',
    '/orders',
  ];
  const match = routes.find((route) => path === route || path.startsWith(`${route}/`));
  return match ? (match as Href) : null;
}
