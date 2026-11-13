import type { CatalogProgress } from './prop-catalog';

/** Generation and add-all validation need a complete slate, unlike progressive discovery. */
export function requireCompleteGeneratorSnapshot<T>(snapshot: {
  markets: T[];
  progress?: CatalogProgress;
}): T[] {
  if (!Array.isArray(snapshot.markets))
    throw new Error('Current props are unavailable. Please try again.');
  if (
    snapshot.progress &&
    (!snapshot.progress.complete ||
      snapshot.progress.loadedEvents !== snapshot.progress.totalEvents)
  )
    throw new Error(
      'Game research is still loading. Please try again when the full slate is ready.',
    );
  return snapshot.markets;
}
