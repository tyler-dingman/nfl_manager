'use client';

import { BellRing, Check, Mail } from 'lucide-react';
import { DdMessagesIcon as MessageCircle } from '@/components/ui/football-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import DeliveryTiming from './delivery-timing';
import { DEFAULT_DELIVERY_TIME, deviceTimezone } from '../../../packages/three-and-out/schedule';
import styles from './three-out-delivery-preferences.module.css';

import { useAuthUser } from '@/features/auth/auth-session';

type Channel = 'email' | 'sms' | 'push';
type Preferences = Record<Channel, boolean> & {
  enabled: boolean;
  deliveryTime?: string;
  timezone?: string;
  emailAvailable?: boolean;
  hasVerifiedPhone?: boolean;
  hasPushDevice?: boolean;
  smsDeliveryPending?: boolean;
};
const empty: Preferences = { enabled: false, email: false, sms: false, push: false };
const options = [
  { id: 'email' as const, label: 'Email', Icon: Mail },
  { id: 'sms' as const, label: 'SMS', Icon: MessageCircle },
  { id: 'push' as const, label: 'Push', Icon: BellRing },
];

export default function ThreeOutDeliveryPreferences({
  settings = false,
  appearance = 'light',
  compact = false,
}: {
  settings?: boolean;
  compact?: boolean;
  appearance?: 'light' | 'dark';
}) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const [prefs, setPrefs] = useState<Preferences>(empty);
  const [localTimezone, setLocalTimezone] = useState('UTC');
  useEffect(() => setLocalTimezone(deviceTimezone()), []);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    void fetch('/api/three-and-out/preferences', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.preferences) throw new Error();
        setPrefs({
          ...body.preferences,
          deliveryTime: body.preferences.deliveryTime ?? DEFAULT_DELIVERY_TIME,
          timezone: body.preferences.timezone ?? deviceTimezone(),
        });
        setLoaded(true);
      })
      .catch(() => setMessage('Unable to load delivery preferences. Refresh to try again.'));
  }, [user]);

  const save = async (next: Preferences) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/three-and-out/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.preferences)
        throw new Error(body?.error ?? 'Unable to save preferences.');
      setPrefs({
        ...body.preferences,
        deliveryTime: body.preferences.deliveryTime ?? DEFAULT_DELIVERY_TIME,
        timezone: body.preferences.timezone ?? deviceTimezone(),
      });

      setMessage('Delivery preferences updated ✓');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save preferences.');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (channel: Channel) => {
    if (!hydrated) return;
    if (!user) {
      router.push('/account?returnTo=/#three-and-out');
      return;
    }
    const next = {
      ...prefs,
      ...(prefs.enabled ? {} : { email: false, sms: false, push: false }),
      [channel]: !(prefs.enabled && prefs[channel]),
    };
    await save({ ...next, enabled: next.email || next.sms || next.push });
  };
  const selected = options.filter((option) => prefs[option.id]);
  const controls = (
    <div className={`grid grid-cols-3 gap-2 ${appearance === 'dark' ? styles.channelsDark : ''}`}>
      {options.map(({ id, label, Icon }) => {
        const active = prefs[id] && prefs.enabled;
        return (
          <button
            key={id}
            type="button"
            onClick={() => void toggle(id)}
            aria-pressed={active}
            disabled={busy || (!!user && !loaded)}
            className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[10px] font-black uppercase tracking-[.04em] transition ${active ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]' : 'border-[#00172B]/15 bg-white text-[#00172B]'}`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
            {active ? <Check className="absolute right-2 top-2 h-3.5 w-3.5" /> : null}
          </button>
        );
      })}
    </div>
  );

  const timing = (
    <DeliveryTiming
      time={prefs.deliveryTime ?? DEFAULT_DELIVERY_TIME}
      timezone={prefs.timezone ?? localTimezone}
      disabled={busy || !loaded || !user}
      onChange={(deliveryTime) =>
        void save({ ...prefs, deliveryTime, timezone: prefs.timezone ?? deviceTimezone() })
      }
    />
  );

  if (compact)
    return (
      <div>
        {controls}
        {timing}
        {prefs.sms && prefs.hasVerifiedPhone === false ? (
          <p className="mt-2 text-xs text-slate-600">
            Add a verified mobile number for SMS delivery.
          </p>
        ) : null}
        {prefs.push && prefs.hasPushDevice === false ? (
          <p className="mt-2 text-xs text-slate-600">
            Enable notifications on a device to receive push updates.
          </p>
        ) : null}
        {prefs.email && prefs.emailAvailable === false ? (
          <p className="mt-2 text-xs text-slate-600">Add an email address for email delivery.</p>
        ) : null}
        {message ? (
          <p role="status" className="mt-2 text-xs">
            {message}
          </p>
        ) : null}
      </div>
    );

  if (prefs.enabled && !editing && !settings)
    return (
      <div
        className={`border-t border-[#00172B]/10 pt-4 ${appearance === 'dark' ? styles.dark : ''}`}
      >
        <p className="flex items-center gap-2 text-sm font-black uppercase">
          <Check className="h-4 w-4 text-emerald-600" /> Three &amp; Out delivered daily
        </p>
        <div
          className={`mt-1 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500 ${styles.muted}`}
        >
          <span>{selected.map((item) => item.label).join(' · ')}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`font-black text-[#00172B] ${styles.edit}`}
          >
            Edit preferences →
          </button>
        </div>
      </div>
    );

  return (
    <div
      className={`${settings ? 'mt-5' : 'border-t border-[#00172B]/10 pt-5'} ${appearance === 'dark' ? styles.dark : ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[.04em]">
            {settings ? 'Deliver via' : 'Get Three & Out delivered daily'}
          </p>
          {!settings ? (
            <p className={`mt-1 text-xs text-slate-500 ${styles.muted}`}>
              Choose how you want to receive it:
            </p>
          ) : null}
        </div>
        {settings ? (
          <button
            type="button"
            aria-pressed={prefs.enabled}
            onClick={() => user && void save({ ...prefs, enabled: !prefs.enabled })}
            className={`min-h-11 rounded-full px-4 text-xs font-black uppercase ${prefs.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
          >
            {prefs.enabled ? 'On' : 'Off'}
          </button>
        ) : null}
      </div>
      {controls}
      {timing}
      {prefs.email && prefs.emailAvailable === false ? (
        <p className={`mt-2 text-xs text-amber-700 ${styles.warning}`}>
          Add an email address to receive Three & Out by email.
        </p>
      ) : null}
      {prefs.sms && prefs.hasVerifiedPhone === false ? (
        <p className={`mt-2 text-xs text-amber-700 ${styles.warning}`}>
          Add a verified mobile number to receive Three & Out by text. SMS delivery is pending.
        </p>
      ) : null}
      {message ? (
        <p className={`mt-2 text-xs font-semibold text-slate-500 ${styles.muted}`}>{message}</p>
      ) : null}
      {!selected.length && !settings ? (
        <p className={`mt-2 text-center text-xs text-slate-500 ${styles.muted}`}>
          Choose a delivery method to subscribe.
        </p>
      ) : null}
      {!settings ? (
        <p className={`mt-2 text-center text-[11px] text-slate-400 ${styles.muted}`}>
          You can update your preferences anytime.
        </p>
      ) : null}
    </div>
  );
}
