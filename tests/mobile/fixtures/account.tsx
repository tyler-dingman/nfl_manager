import React from 'react';
import { createRoot } from 'react-dom/client';
import AccountDashboard from '../../../src/components/auth/account-dashboard';
const user = {
  id: 'me',
  name: 'Tyler Football Fan',
  displayName: 'Tyler Football Fan',
  email: 'fan@example.com',
  primaryEmail: 'fan@example.com',
  avatarUrl: null,
  firstName: null,
  lastName: null,
  emailVerified: true,
  status: 'ACTIVE' as const,
  createdAt: '',
  lastLoginAt: null,
};
window.fetch = async (url, init) => {
  const path = String(url);
  if (init?.method) {
    document.body.dataset.mutation = String(init.body);
    return Response.json({ preferences: { emailEnabled: false, pushEnabled: true }, profile: {} });
  }
  return Response.json(
    path.includes('stats')
      ? { stats: { lifetimePoints: 2565 } }
      : path.includes('leaderboard')
        ? { rows: [{ userId: 'me', rank: 34 }] }
        : path.includes('crew')
          ? { crew: { name: 'The Huddle' } }
          : path.includes('preferences')
            ? { preferences: { emailEnabled: true, pushEnabled: true } }
            : path.includes('identities')
              ? { identities: [{ id: 'google', provider: 'google' }] }
              : path.includes('config')
                ? { providers: { google: true, apple: true } }
                : {},
  );
};
createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 850, margin: 'auto', containerType: 'inline-size' }}>
    <AccountDashboard user={user} teamAbbr="DET" />
  </main>,
);
