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

const extractSaveIdFromRequest = (url: string, init?: RequestInit) => {
  try {
    const parsedUrl = new URL(url, 'http://localhost');
    const querySaveId = parsedUrl.searchParams.get('saveId');
    if (querySaveId) {
      return querySaveId;
    }
  } catch {
    // ignore URL parsing failures
  }

  if (typeof init?.body === 'string') {
    try {
      const parsedBody = JSON.parse(init.body) as { saveId?: string };
      if (parsedBody.saveId) {
        return parsedBody.saveId;
      }
    } catch {
      // ignore body parsing failures
    }
  }

  return null;
};

const getCurrentActiveSaveId = () => {
  if (typeof window === 'undefined') return null;

  try {
    const localSaveId = localStorage.getItem('falco_active_save_id');
    if (localSaveId) {
      return localSaveId;
    }

    const persisted = localStorage.getItem('nfl-manager-save');
    if (!persisted) {
      return null;
    }

    const parsed = JSON.parse(persisted) as { state?: { saveId?: string } };
    return parsed.state?.saveId ?? null;
  } catch {
    return null;
  }
};

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

export const apiFetch = async (
  path: string,
  init?: RequestInit,
  options?: { skipSaveGuard?: boolean },
) => {
  const url = apiUrl(path);
  const response = await fetch(url, init);
  if (!options?.skipSaveGuard && response.status === 404 && shouldGuard404(url)) {
    const requestedSaveId = extractSaveIdFromRequest(url, init);
    const activeSaveId = getCurrentActiveSaveId();
    const shouldRedirect =
      requestedSaveId !== null && activeSaveId !== null && requestedSaveId === activeSaveId;

    if (!shouldRedirect) {
      return response;
    }
    handleSaveNotFound();
  }
  return response;
};
