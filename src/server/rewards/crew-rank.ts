/** Crew migrations may lag rewards deployments. Missing crew data must not hide rewards. */
export async function loadCrewRank(query: () => PromiseLike<{ rank: number }[]>) {
  try {
    const rows = await query();
    return { rank: rows[0]?.rank ?? null, available: true };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01') {
      return { rank: null, available: false };
    }
    throw error;
  }
}
