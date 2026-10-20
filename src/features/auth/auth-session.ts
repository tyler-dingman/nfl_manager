'use client';

import { useSaveStore, resetPrivateSaveMemory } from '@/features/save/save-store';
import { webFranchiseTransport } from '../../../packages/front-office/command-transport';

import { firebaseWebSignOut, startFirebaseWebSession } from './firebase-client';
import { useCallback, useEffect, useState } from 'react';

export type AuthUser = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING';
  createdAt: string;
  lastLoginAt: string | null;
  name: string;
  email: string;
};

let franchiseCacheQuarantined = false;
function clearPrivateFranchiseView(owner: string | null) {
  if (typeof window === 'undefined') return true;
  try {
    const original = localStorage.getItem('nfl-manager-save');
    if (original) {
      const saveId = useSaveStore.getState().saveId || 'unknown';
      localStorage.setItem(
        `nfl-manager-save-recovery:${owner ?? 'unverified'}:${saveId}`,
        original,
      );
    }
    useSaveStore.getState().clearSave();
    franchiseCacheQuarantined = false;
    return true;
  } catch {
    // Storage may be full or unavailable. Leave the recovery bytes intact, but hide private UI.
    useSaveStore.persist.setOptions({
      storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    });
    franchiseCacheQuarantined = true;
    resetPrivateSaveMemory();
    // Keep persistence suspended: subsequent UI changes must not overwrite the unbacked original.
    return false;
  }
}

const EVENT_NAME = 'dd-auth-session-change';
let cachedUser: AuthUser | null = null;
let loaded = false;
let pendingUser: Promise<AuthUser | null> | null = null;

const normalize = (user: Omit<AuthUser, 'name' | 'email'>): AuthUser => ({
  ...user,
  name: user.displayName,
  email: user.primaryEmail ?? '',
});

export async function fetchAuthUser() {
  if (pendingUser) return pendingUser;
  const request = (async () => {
    const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { user: Omit<AuthUser, 'name' | 'email'> | null };
    return body.user ? normalize(body.user) : null;
  })();
  pendingUser = request;
  try {
    return await request;
  } finally {
    if (pendingUser === request) pendingUser = null;
  }
}

export function notifyAuthChanged() {
  webFranchiseTransport.reset();
  loaded = false;
  pendingUser = null;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export async function clearPreviewSession() {
  webFranchiseTransport.reset();
  await firebaseWebSignOut().catch(() => {});
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  clearPrivateFranchiseView(cachedUser?.id ?? null);
  cachedUser = null;
  loaded = true;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [hydrated, setHydrated] = useState(loaded);
  const sync = useCallback(async () => {
    const next = await fetchAuthUser().catch(() => null);
    let previousOwner = cachedUser?.id ?? null;
    try {
      previousOwner ||= localStorage.getItem('dd-franchise-cache-owner');
    } catch {}
    let safeOwnerTag = true;
    if (previousOwner !== (next?.id ?? null)) {
      webFranchiseTransport.reset();
      safeOwnerTag = clearPrivateFranchiseView(previousOwner);
    }
    try {
      if (next && safeOwnerTag && !franchiseCacheQuarantined)
        localStorage.setItem('dd-franchise-cache-owner', next.id);
      else localStorage.removeItem('dd-franchise-cache-owner');
    } catch {}
    cachedUser = next;
    loaded = true;
    setUser(next);
    setHydrated(true);
  }, []);
  useEffect(() => {
    void startFirebaseWebSession().catch(() => {});
    if (!loaded) void sync();
    else {
      setUser(cachedUser);
      setHydrated(true);
    }
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('dd-firebase-session-refresh', notifyAuthChanged);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('dd-firebase-session-refresh', notifyAuthChanged);
    };
  }, [sync]);
  return { user, hydrated, refresh: sync };
}

/** @deprecated Production auth is server-backed. */
export function createPreviewSession(): never {
  throw new Error('Preview authentication has been removed.');
}
/** @deprecated Update profiles through the authenticated API. */
export function updatePreviewUser(updates: { name: string; email: string }): null {
  void fetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ displayName: updates.name, primaryEmail: updates.email }),
  }).then((response) => {
    if (response.ok) notifyAuthChanged();
  });
  return null;
}
