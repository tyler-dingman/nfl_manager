'use client';

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

const EVENT_NAME = 'dd-auth-session-change';
let cachedUser: AuthUser | null = null;
let loaded = false;

const normalize = (user: Omit<AuthUser, 'name' | 'email'>): AuthUser => ({
  ...user,
  name: user.displayName,
  email: user.primaryEmail ?? '',
});

export async function fetchAuthUser() {
  const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) return null;
  const body = (await response.json()) as { user: Omit<AuthUser, 'name' | 'email'> };
  return normalize(body.user);
}

export function notifyAuthChanged() {
  loaded = false;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export async function clearPreviewSession() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  cachedUser = null;
  loaded = true;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [hydrated, setHydrated] = useState(loaded);
  const sync = useCallback(async () => {
    const next = await fetchAuthUser().catch(() => null);
    cachedUser = next;
    loaded = true;
    setUser(next);
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!loaded) void sync();
    else {
      setUser(cachedUser);
      setHydrated(true);
    }
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
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
