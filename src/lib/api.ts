export const apiUrl = (path: string) => {
  if (path.startsWith('/api/')) return path;
  if (path.startsWith('api/')) return `/${path}`;
  if (path.startsWith('/')) return `/api${path}`;
  return `/api/${path}`;
};

export const apiFetch = (path: string, init?: RequestInit) => fetch(apiUrl(path), init);
