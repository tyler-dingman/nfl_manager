import { useSyncExternalStore } from 'react';
const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};
const snapshot = () => window.location.href;
const navigate = (url: string, replace = false) => {
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
const router = {
  push: (url: string) => navigate(url),
  replace: (url: string) => navigate(url, true),
};
export const useRouter = () => router;
export const useSearchParams = () =>
  new URLSearchParams(new URL(useSyncExternalStore(subscribe, snapshot, snapshot)).search);
export const usePathname = () =>
  new URL(useSyncExternalStore(subscribe, snapshot, snapshot)).pathname;
