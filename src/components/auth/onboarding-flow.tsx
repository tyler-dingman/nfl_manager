'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bell, Check, MessageSquare } from 'lucide-react';
import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import { TEAM_LIST } from '@/data/teams';
import { useAuthUser } from '@/features/auth/auth-session';
import { saveFanTeamPreference } from '@/features/team/fan-team-preference';
export default function OnboardingFlow() {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const [step, setStep] = useState(1);
  const [team, setTeam] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (hydrated && !user) router.replace('/login?next=/onboarding');
    if (user)
      void fetch('/api/user/onboarding')
        .then((r) => r.json())
        .then((b) => {
          const savedStep = b.onboarding?.step ?? 1;
          setStep(savedStep >= 5 ? 3 : savedStep >= 2 ? 2 : 1);
        });
  }, [hydrated, router, user]);
  const saveStep = async (next: number, complete = false) => {
    setBusy(true);
    try {
      if (step === 1 && team) {
        await saveFanTeamPreference(team);
      }
      if (step === 2 && pushEnabled)
        await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pushEnabled: true }),
        });
      if (step === 3)
        await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ smsEnabled: sms }),
        });
      await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: next, completed: complete }),
      });
      if (complete) router.push('/');
      else setStep(next);
    } finally {
      setBusy(false);
    }
  };
  if (!hydrated || !user) return <div className="min-h-screen bg-[#f7f4ee]" />;
  return (
    <main className="min-h-screen bg-[#f7f4ee] px-4 py-8 text-[#00172B]">
      <div className="mx-auto max-w-3xl">
        <FiveWideLogo
          generic
          size={80}
          containerClassName="mx-auto h-auto w-44 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0"
        />
        <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-[0_24px_70px_rgba(0,23,43,.1)] sm:p-10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#FF3D38]">
              Set your D&amp;D
            </p>
            <p className="text-xs font-black text-[#00172B]/35">{step} / 3</p>
          </div>
          {step === 1 && (
            <section>
              <h1 className="mt-5 text-4xl font-black uppercase tracking-[-.04em]">
                Who&apos;s your team?
              </h1>
              <div className="mt-6 grid max-h-[420px] grid-cols-2 gap-2 overflow-auto sm:grid-cols-4">
                {TEAM_LIST.map((t) => (
                  <button
                    key={t.abbr}
                    onClick={() => setTeam(t.abbr)}
                    className={`rounded-2xl border p-3 text-left text-sm font-black ${team === t.abbr ? 'border-[#FF3D38] bg-[#fff0e9]' : 'border-[#00172B]/10'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {step === 2 && (
            <section className="py-10 text-center">
              <Bell className="mx-auto h-12 w-12 text-[#FF3D38]" />
              <h1 className="mt-5 text-4xl font-black uppercase tracking-[-.04em]">
                Get the important stuff.
              </h1>
              <p className="mx-auto mt-4 max-w-md font-semibold leading-7 text-[#00172B]/55">
                Get breaking team news and meaningful updates on this device.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (!('Notification' in window)) return;
                  setPushEnabled((await Notification.requestPermission()) === 'granted');
                }}
                className={`mx-auto mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black ${pushEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-[#00172B] text-white'}`}
              >
                <Bell className="h-4 w-4" />
                {pushEnabled ? 'Push enabled' : 'Enable push notifications'}
              </button>
            </section>
          )}
          {step === 3 && (
            <section className="py-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-[#FF3D38]" />
              <h1 className="mt-5 text-4xl font-black uppercase tracking-[-.04em]">
                Big news. Straight to your phone.
              </h1>
              <p className="mx-auto mt-4 max-w-md font-semibold leading-7 text-[#00172B]/55">
                SMS is optional and reserved for major, breaking alerts.
              </p>
              <label className="mx-auto mt-6 flex max-w-sm items-center justify-between rounded-2xl border p-4 text-left font-black">
                Invite me when SMS launches
                <input
                  type="checkbox"
                  checked={sms}
                  onChange={(e) => setSms(e.target.checked)}
                  className="h-5 w-5 accent-[#FF3D38]"
                />
              </label>
            </section>
          )}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="text-sm font-black text-[#00172B]/45"
            >
              Finish later
            </button>
            <button
              disabled={busy || (step === 1 && !team)}
              onClick={() => void saveStep(Math.min(3, step + 1), step === 3)}
              className="flex h-12 items-center gap-2 rounded-full bg-[#00172B] px-6 font-black text-white disabled:opacity-40"
            >
              {step === 3 ? (
                <>
                  <Check className="h-4 w-4" />
                  Finish
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
