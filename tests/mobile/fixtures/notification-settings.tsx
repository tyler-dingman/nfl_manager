import React from 'react';
import { createRoot } from 'react-dom/client';
import NotificationSettings from '../../../src/components/notifications/notification-settings';
window.fetch = async (url, init) => {
  const path = String(url);
  if (init?.method) {
    document.body.dataset.mutation = String(init.body);
    if (document.body.dataset.fail === 'true')
      return Response.json({ error: 'Failed' }, { status: 500 });
    return Response.json({ preferences: JSON.parse(String(init.body)) });
  }
  return Response.json(
    path.includes('/auth/me')
      ? { user: { id: 'test', displayName: 'Fan', primaryEmail: 'fan@example.com' } }
      : path.includes('/three-and-out/')
        ? { preferences: { email: true, sms: false, push: false, enabled: true } }
        : path.includes('/push/')
          ? { publicKey: null }
          : {
              preferences: [
                {
                  category: 'BREAKING_NEWS',
                  channel: 'IN_APP',
                  enabled: false,
                  topicType: 'TEAM',
                  topicId: 'KC',
                },
              ],
            },
  );
};
createRoot(document.getElementById('root')!).render(
  <main
    style={
      {
        maxWidth: 850,
        margin: 'auto',
        containerType: 'inline-size',
        '--team-primary': '#0076b6',
        '--team-on-primary': 'white',
      } as React.CSSProperties
    }
  >
    <NotificationSettings teamAbbr="DET" />
  </main>,
);
