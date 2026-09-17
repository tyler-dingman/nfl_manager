export const apiUrl = (path: string) => {
  if (path.startsWith('/api/')) return path;
  if (path.startsWith('api/')) return `/${path}`;
  if (path.startsWith('/')) return `/api${path}`;
  return `/api/${path}`;
};

export const apiFetch = async (
  path: string,
  init?: RequestInit,
  options?: { skipSaveGuard?: boolean },
) => {
  const url = apiUrl(path);
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
    // Framework errors and login redirects can return HTML even for API requests.
    // Exclude query strings and response bodies, which may contain private data.
    const endpoint = url.split(/[?#]/, 1)[0];
    const reason = response.redirected
      ? 'The request was redirected to a web page. Refresh and sign in again.'
      : response.status >= 500
        ? 'The server could not complete the request. Please try again.'
        : 'The server returned a web page instead of API data. Please refresh and try again.';
    throw new Error(`${reason} (${endpoint}, HTTP ${response.status})`);
  }
  return response;
};
