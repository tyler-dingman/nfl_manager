export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.downdistance.com'
).replace(/\/$/, '');

export async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('Connection timed out. Please check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
