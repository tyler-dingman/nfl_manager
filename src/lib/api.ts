export const apiUrl = (path: string) => {
  if (path.startsWith('/api/')) return path;
  if (path.startsWith('api/')) return `/${path}`;
  if (path.startsWith('/')) return `/api${path}`;
  return `/api/${path}`;
};

const SAVE_GUARD_KEYS = ['falco_active_save_id', 'falco_save_expired', 'nfl-manager-save'];

let didRedirectForMissingSave = false;

const shouldGuard404 = (url: string) =>
  url.includes('/api/saves/') ||
  url.includes('/api/roster') ||
  url.includes('/api/contracts/expiring') ||
  url.includes('/api/free-agents') ||
  url.includes('/api/trades');

const handleSaveNotFound = () => {
  if (typeof window === 'undefined') return;
  if (didRedirectForMissingSave) return;
  didRedirectForMissingSave = true;
  SAVE_GUARD_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  });
  try {
    localStorage.setItem('falco_save_expired', '1');
  } catch {
    // ignore storage errors
  }
  window.location.assign('/');
};

export const apiFetch = async (path: string, init?: RequestInit) => {
  const url = apiUrl(path);
  const response = await fetch(url, init);
  if (response.status === 404 && shouldGuard404(url)) {
    handleSaveNotFound();
  }
  return response;
};
