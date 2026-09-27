/** Do not expose JSON parser errors when a proxy/server returns an empty or HTML response. */
export async function readCrewResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : response.status === 401
          ? 'Sign in to access your Crew.'
          : 'The Crew is unavailable right now. Please try again.',
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The Crew returned an incomplete response. Please try again.');
  }
  return data;
}
