'use client';

import { BellRing, Check, Mail } from 'lucide-react';
import { DdMessagesIcon as MessageCircle } from '@/components/ui/football-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthUser } from '@/features/auth/auth-session';

type Channel = 'email' | 'sms' | 'push';
type Preferences = Record<Channel, boolean> & {
  enabled: boolean;
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

export default function ThreeOutDeliveryPreferences({ settings = false }: { settings?: boolean }) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const [prefs, setPrefs] = useState<Preferences>(empty);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    void fetch('/api/three-and-out/preferences', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.preferences && setPrefs(body.preferences));
  }, [user]);

  const save = async (next: Preferences) => {
    setBusy(true);
    setMessage(null);
    const response = await fetch('/api/three-and-out/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setMessage(body?.error ?? 'Unable to save preferences.');
    setPrefs(body.preferences);
    setEditing(false);
  };
  const toggle = async (channel: Channel) => {
    if (!hydrated) return;
    if (!user) {
      router.push('/account?returnTo=/#three-and-out');
      return;
    }
    if (channel === 'push' && !prefs.push && typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      if (permission === 'denied')
        setMessage('Enable notifications in your browser settings to receive push updates.');
    }
    setPrefs((current) => ({ ...current, [channel]: !current[channel] }));
  };
  const selected = options.filter((option) => prefs[option.id]);
  const controls = (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map(({ id, label, Icon }) => {
        const active = prefs[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => void toggle(id)}
            aria-pressed={active}
            className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[10px] font-black uppercase tracking-[.04em] transition ${active ? 'border-[#f04b32] bg-[#fff2ed] text-[#9f2d1d]' : 'border-[#00172B]/15 bg-white text-[#00172B]'}`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
            {active ? <Check className="absolute right-2 top-2 h-3.5 w-3.5" /> : null}
          </button>
        );
      })}
    </div>
  );

  if (prefs.enabled && !editing && !settings)
    return (
      <div className="border-t border-[#00172B]/10 pt-4">
        <p className="flex items-center gap-2 text-sm font-black uppercase">
          <Check className="h-4 w-4 text-emerald-600" /> Three &amp; Out delivered daily
        </p>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <span>{selected.map((item) => item.label).join(' · ')}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-black text-[#00172B]"
          >
            Edit preferences →
          </button>
        </div>
      </div>
    );

  return (
    <div className={settings ? 'mt-5' : 'border-t border-[#00172B]/10 pt-5'}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[.04em]">
            {settings ? 'Deliver via' : 'Get Three & Out delivered daily'}
          </p>
          {!settings ? (
            <p className="mt-1 text-xs text-slate-500">Choose how you want to receive it:</p>
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
      {prefs.email && prefs.emailAvailable === false ? (
        <p className="mt-2 text-xs text-amber-700">
          Add an email address to receive Three & Out by email.
        </p>
      ) : null}
      {prefs.sms && prefs.hasVerifiedPhone === false ? (
        <p className="mt-2 text-xs text-amber-700">
          Add a verified mobile number to receive Three & Out by text. SMS delivery is pending.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <button
        type="button"
        disabled={busy || (!selected.length && !settings)}
        onClick={() =>
          user
            ? void save({ ...prefs, enabled: selected.length > 0 })
            : router.push('/account?returnTo=/#three-and-out')
        }
        className="team-primary-filled mt-3 min-h-12 w-full rounded-xl px-4 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? 'Saving…'
          : user
            ? settings
              ? 'Save delivery preferences'
              : prefs.enabled
                ? 'Update Three & Out'
                : 'Subscribe to Three & Out'
            : 'Sign in to subscribe'}
      </button>
      {!selected.length && !settings ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Choose at least one delivery method.
        </p>
      ) : null}
      {!settings ? (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          You can update your preferences anytime.
        </p>
      ) : null}
    </div>
  );
}
