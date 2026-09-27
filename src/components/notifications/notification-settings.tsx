'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Newspaper,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import BrowserPushSettings from './browser-push-settings';
import ThreeOutDeliveryPreferences from '@/components/three-and-out/three-out-delivery-preferences';
import { getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import profile from '@/components/auth/account-dashboard.module.css';
import styles from './notification-settings.module.css';

import { NOTIFICATION_CATEGORIES } from '../../../packages/notifications/settings';
const icons = { Bell, BriefcaseBusiness, CalendarDays, Newspaper, Trophy, Users };
const categories = NOTIFICATION_CATEGORIES.map((category) => ({
  ...category,
  Icon: icons[category.icon],
}));
type Preference = {
  category: string;
  enabled: boolean;
  channel: string;
  topicType: string | null;
  topicId: string | null;
};
export default function NotificationSettings({ teamAbbr }: { teamAbbr: string | null }) {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void fetch('/api/user/notification-preferences', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (!active) return;
        const saved = (body.preferences as Preference[]).filter(
          (p) => p.channel === 'IN_APP' && !p.topicType && !p.topicId,
        );
        setSettings(
          Object.fromEntries(
            categories.map((c) => [
              c.key,
              saved.find((p) => p.category === c.key)?.enabled ?? true,
            ]),
          ),
        );
        setMessage('');
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setMessage('Unable to load preferences. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  async function update(keys: string[], enabled: boolean) {
    setBusy(true);
    setMessage('');
    let failed = false;
    for (const category of keys) {
      try {
        const response = await fetch('/api/user/notification-preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ category, channel: 'IN_APP', enabled }),
        });
        if (!response.ok) throw new Error();
        setSettings((current) => ({ ...current, [category]: enabled }));
      } catch {
        failed = true;
      }
    }
    setMessage(
      failed ? 'Some changes could not be saved. Please try again.' : 'Preferences updated ✓',
    );
    setBusy(false);
  }
  const allOn = categories.every((c) => settings[c.key]);
  return (
    <div
      className={styles.page}
      style={
        {
          '--account-accent': getEditorialHeroTheme(teamAbbr ?? 'NFL').heroPrimaryAccent,
        } as CSSProperties
      }
    >
      <header className={`${profile.hero} ${styles.hero}`}>
        <div>
          <p className={profile.eyebrow}>NOTIFICATIONS</p>
          <h1>Stay in the know</h1>
          <p>Get the latest news, updates and activity across Down &amp; Distance.</p>
        </div>
      </header>
      <BrowserPushSettings />
      <section className={styles.card} aria-labelledby="notification-preferences-heading">
        <div className={styles.header}>
          <Settings aria-hidden="true" />
          <div className={styles.copy}>
            <h2 id="notification-preferences-heading">Notification Preferences</h2>
            <p>Choose what you want to hear about. You can update these at any time.</p>
          </div>
          <button
            className={styles.button}
            disabled={loading || busy || loadError}
            onClick={() =>
              void update(
                categories.map((c) => c.key),
                !allOn,
              )
            }
          >
            Turn All {allOn ? 'Off' : 'On'}
          </button>
        </div>
        {loading ? (
          <p role="status">Loading preferences…</p>
        ) : loadError ? (
          <button className={styles.button} onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        ) : (
          <div className={styles.rows}>
            {categories.map(({ key, label, description, Icon }) => (
              <div className={styles.row} key={key}>
                <Icon aria-hidden="true" />
                <div className={styles.rowCopy}>
                  <strong>{label}</strong>
                  <p>{description}</p>
                </div>
                <button
                  type="button"
                  className={styles.toggle}
                  role="switch"
                  aria-label={label}
                  aria-checked={Boolean(settings[key])}
                  disabled={busy}
                  onClick={() => void update([key], !settings[key])}
                >
                  <span />
                </button>
              </div>
            ))}
          </div>
        )}
        {message ? <p role="status">{message}</p> : null}
      </section>
      <section className={`${styles.card} ${styles.delivery}`}>
        <div className={styles.header}>
          <CalendarDays aria-hidden="true" />
          <div className={styles.copy}>
            <h2>Three &amp; Out Delivery</h2>
            <p>Choose how you want to receive your daily Three &amp; Out.</p>
          </div>
        </div>
        <ThreeOutDeliveryPreferences settings compact />
      </section>
      <section className={`${styles.card} ${styles.header}`}>
        <ShieldCheck aria-hidden="true" />
        <div className={styles.copy}>
          <h2>You’re in control</h2>
          <p>You can update your notification preferences at any time.</p>
        </div>
      </section>
    </div>
  );
}
