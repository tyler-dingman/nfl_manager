export function runContentContinuations(
  send: (query: URLSearchParams) => Promise<any>,
  limit?: number,
): Promise<{ calls: number; complete: boolean }>;
