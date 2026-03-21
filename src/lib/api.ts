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
  return response;
};
