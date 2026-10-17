import { UnabatedClient } from './client';
import type { ShadowSelection } from './coverage';

/** Only generic returned Gambly odds links get a tracking suffix. Preserve exact points. */
export function trackedOddsLink(returnedLink: string, partnerCode: string): string | null {
  if (!partnerCode.trim()) return null;
  try {
    const url = new URL(returnedLink);
    if (
      url.origin !== 'https://www.gambly.com' ||
      url.username ||
      url.password ||
      !/^\/deeplink\/odds\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname)
    )
      return null;
    url.searchParams.set('utm_campaign', partnerCode);
    return url.toString();
  } catch {
    return null;
  }
}

/** Shadow-only service. Callers must resolve every requested leg against current DB rows first.
 * Not wired to My Parlay until live IDs, complete transfers, and attribution are validated.
 * Never attempts an Enterprise-only SGP endpoint with a Free account. */
export async function verifyFreeTransfer(
  selections: ShadowSelection[],
  options: {
    client: Pick<UnabatedClient, 'deepLink'>;
    fanDuelSourceId: number;
    partnerCode: string;
    state?: string;
    now?: number;
  },
): Promise<{ supported: boolean; url?: string; reason?: string }> {
  const reject = (reason: string) => ({ supported: false, reason });
  if (!selections.length || selections.length > 20) return reject('Select between 1 and 20 legs.');
  if (!options.partnerCode.trim()) return reject('Partner attribution is not configured.');
  const now = options.now ?? Date.now();
  if (
    selections.some(
      (s) =>
        !s.available ||
        s.marketSourceId !== options.fanDuelSourceId ||
        s.marketLineId == null ||
        !Number.isSafeInteger(s.marketLineId) ||
        !s.eventStart ||
        !(Date.parse(s.eventStart) > now) ||
        !s.freshnessExpiresAt ||
        !(Date.parse(s.freshnessExpiresAt) > now),
    )
  )
    return reject(
      'Every leg needs a current, available FanDuel selection with verified freshness.',
    );
  if (new Set(selections.map((s) => s.eventId)).size !== selections.length)
    return reject('Same-game transfers are not enabled for the Free tier.');
  const ids = selections.map((s) => s.marketLineId!);
  if (new Set(ids).size !== ids.length) return reject('Duplicate provider market-line IDs.');
  const result = await options.client.deepLink(
    ids,
    selections.map((s) => s.points),
    options.state,
  );
  if (
    result.status !== 0 ||
    result.statusString !== 'full_support' ||
    !result.url ||
    result.ids?.length !== ids.length ||
    new Set(result.ids).size !== ids.length ||
    !ids.every((id) => result.ids!.includes(id))
  )
    return reject('Provider did not confirm every selection is fully supported.');
  const url = trackedOddsLink(result.url, options.partnerCode);
  return url ? { supported: true, url } : reject('No valid attributed full-slip URL returned.');
}
