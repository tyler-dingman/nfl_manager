import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  FrontOfficeSaveMetadata,
  FrontOfficeEvent,
  FrontOfficeTradeOfferStatus,
} from '@/types/front-office';
import type { TradeOfferDTO } from '@/types/trade-offers';
export type FranchiseAggregate = {
  metadata: FrontOfficeSaveMetadata & {
    version: number;
    simulation: import('@/types/front-office').FranchiseSimulationState | null;
  };
  encoded: unknown;
  referenceHash: string;
  events: Record<string, FrontOfficeEvent & { dedupeKey?: string }>;
  offers: Record<
    string,
    {
      offer: TradeOfferDTO;
      status: FrontOfficeTradeOfferStatus;
      expiresWeek: number;
      createdWeek: number;
    }
  >;
};
type Scope = { owner: string; value: FranchiseAggregate; writable: boolean };
const scopeSymbol = Symbol.for('down-distance.d1-franchise-scope');
const scopeGlobals = globalThis as typeof globalThis & { [key: symbol]: unknown };
export const d1Franchise = (scopeGlobals[scopeSymbol] ??=
  new AsyncLocalStorage<Scope>()) as AsyncLocalStorage<Scope>;
export function ownedFranchise(owner: string, saveId?: string) {
  const scope = d1Franchise.getStore();
  if (!scope || scope.owner !== owner || (saveId && scope.value.metadata.saveId !== saveId))
    throw Error('Owned D1 franchise scope required');
  return scope;
}
