import { AsyncLocalStorage } from 'node:async_hooks';
import type { SaveState } from '@/server/api/store';

/** A handler's mutable workspace. Never shared between requests or published before commit. */
export type FranchiseWorkspace = {
  userId: string;
  user: import('@/server/auth/types').PublicUser;
  saveId: string;
  version: number;
  saves: Map<string, SaveState>;
  trades: Map<string, unknown>;
  teamIndex: Map<string, string>;
  writable: boolean;
  recoveryReferences?: import('./durable-codec').ReferenceBundle;
};
const workspaceSymbol = Symbol.for('down-distance.franchise-workspace');
const workspaceGlobals = globalThis as typeof globalThis & { [key: symbol]: unknown };
export const franchiseWorkspace = (workspaceGlobals[workspaceSymbol] ??=
  new AsyncLocalStorage<FranchiseWorkspace>()) as AsyncLocalStorage<FranchiseWorkspace>;

export function isolatedMap<K, V>(
  kind: 'saves' | 'trades' | 'teamIndex',
  fallback: Map<K, V>,
): Map<K, V> {
  return new Proxy(fallback, {
    get(target, property) {
      const scoped = franchiseWorkspace.getStore()?.[kind] as Map<K, V> | undefined;
      const map = scoped ?? target;
      const value = Reflect.get(map, property, map);
      return typeof value === 'function' ? value.bind(map) : value;
    },
  });
}
