'use client';

import Link from 'next/link';
import { Check, Goal, Lock, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { readCanonicalFanTeamPreference } from '@/features/team/fan-team-preference';
import { useTeamStore } from '@/features/team/team-store';

type Reward = {
  id: string;
  thresholdYards: number;
  type: string;
  title: string;
  description: string;
  status: string;
  couponCode?: string | null;
};
type Dashboard = {
  progress: { currentDriveYards: number; touchdowns: number; lifetimeYards: number };
  nextReward: Reward | null;
  yardsToNextReward: number;
  rewards: Reward[];
};

export default function RewardsPage() {
  const teams = useTeamStore((state) => state.teams);
  const [teamAbbr, setTeamAbbr] = useState<string | null>(null);
  const team = useMemo(
    () => teams.find((candidate) => candidate.abbr === teamAbbr),
    [teamAbbr, teams],
  );
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    fetch('/api/rewards')
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401 ? 'Sign in to see your rewards.' : 'Rewards are unavailable.',
          );
        return response.json();
      })
      .then((body) => setData(body.rewards))
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    void readCanonicalFanTeamPreference().then(setTeamAbbr);
    void load();
  }, []);
  const claim = async (id: string) => {
    const response = await fetch(`/api/rewards/${id}/claim`, { method: 'POST' });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'Unable to claim reward.');
      return;
    }
    await load();
  };
  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <MainSiteHeader teamAbbr={team?.abbr} active={null} />
        <main className="mx-auto max-w-[1180px] px-5 py-12">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FF3D38]">
            Move The Chains
          </p>
          <h1 className="mt-2 text-5xl font-black sm:text-7xl">Engagement Rewards</h1>
          {error ? (
            <div className="mt-8 rounded-3xl bg-white p-8 text-lg font-bold">{error}</div>
          ) : null}
          {data ? (
            <>
              <section className="mt-9 grid gap-4 md:grid-cols-3">
                <Stat
                  icon={<Goal />}
                  label="Current drive"
                  value={`${data.progress.currentDriveYards} / 100`}
                />
                <Stat
                  icon={<Trophy />}
                  label="Touchdowns"
                  value={String(data.progress.touchdowns)}
                />
                <Stat
                  icon={<Goal />}
                  label="Lifetime yards"
                  value={data.progress.lifetimeYards.toLocaleString()}
                />
              </section>
              <section className="mt-5 rounded-[2rem] bg-[#FF3D38] p-7 text-white sm:p-10">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F4D9B7]">
                  Next reward
                </p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <h2 className="text-3xl font-black">
                      {data.nextReward?.title ?? 'End zone reached'}
                    </h2>
                    <p className="mt-2 font-bold text-white/75">
                      {data.nextReward
                        ? `${data.yardsToNextReward} yards to go`
                        : 'Every reward is unlocked.'}
                    </p>
                  </div>
                  <div className="text-5xl font-black">
                    {data.nextReward?.thresholdYards.toLocaleString() ??
                      data.progress.lifetimeYards.toLocaleString()}
                  </div>
                </div>
              </section>
              <h2 className="mt-12 text-3xl font-black">Reward ladder</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {data.rewards.map((reward) => (
                  <article
                    key={reward.id}
                    className={`rounded-3xl border p-6 ${reward.status === 'LOCKED' ? 'border-[#00172B]/10 bg-white/60 text-[#00172B]/50' : 'border-[#FF3D38]/25 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em]">
                          {reward.thresholdYards.toLocaleString()} yards
                        </p>
                        <h3 className="mt-2 text-2xl font-black">{reward.title}</h3>
                        <p className="mt-2 text-sm font-medium opacity-70">{reward.description}</p>
                      </div>
                      {reward.status === 'LOCKED' ? <Lock /> : <Check className="text-[#FF3D38]" />}
                    </div>
                  </article>
                ))}
              </div>
              <h2 className="mt-12 text-3xl font-black">The Locker</h2>
              <p className="mt-2 max-w-2xl font-medium text-[#00172B]/55">
                This is where your unlocked merch discounts and earned rewards live. Lifetime Yards
                never get spent—each milestone permanently opens its reward.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {data.rewards.every((reward) => reward.status === 'LOCKED') ? (
                  <section className="rounded-[2rem] border border-dashed border-[#00172B]/20 bg-white/65 p-7 md:col-span-2 sm:p-9">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4D9B7] text-[#00172B]">
                      <Goal className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-2xl font-black">
                      Your Locker is waiting for its first reward.
                    </h3>
                    <p className="mt-2 max-w-2xl leading-7 text-[#00172B]/60">
                      Reach 50 Lifetime Yards to unlock 5% off merch. Earn Yards by answering Trivia
                      correctly, finishing a full game, completing Get Caught Up, and making
                      predictions.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href="/trivia"
                        className="rounded-full bg-[#FF3D38] px-5 py-3 text-sm font-black text-white"
                      >
                        Play Trivia
                      </Link>
                      <Link
                        href="/catch-up"
                        className="rounded-full border border-[#00172B]/15 bg-white px-5 py-3 text-sm font-black"
                      >
                        Get Caught Up
                      </Link>
                    </div>
                  </section>
                ) : null}
                {data.rewards
                  .filter((r) => r.status !== 'LOCKED')
                  .map((reward) => (
                    <article key={reward.id} className="rounded-3xl bg-[#00172B] p-6 text-white">
                      <p className="text-xs font-black uppercase tracking-[.2em] text-[#F4D9B7]">
                        {reward.status}
                      </p>
                      <h3 className="mt-2 text-2xl font-black">{reward.title}</h3>
                      {reward.couponCode ? (
                        <p className="mt-4 rounded-xl bg-white/10 p-3 font-mono font-black">
                          {reward.couponCode}
                        </p>
                      ) : null}
                      {reward.status === 'AVAILABLE' ? (
                        <button
                          onClick={() => claim(reward.id)}
                          className="mt-5 rounded-full bg-[#FF3D38] px-5 py-3 text-sm font-black"
                        >
                          {reward.type === 'STICKER_PACK' ? 'Claim' : 'Generate code'}
                        </button>
                      ) : null}
                      <p className="mt-4 text-xs text-white/45">
                        Merch checkout activation is pending; claiming does not fake a checkout
                        redemption.
                      </p>
                    </article>
                  ))}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[2rem] bg-white p-7 shadow-sm">
      <div className="text-[#FF3D38]">{icon}</div>
      <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#00172B]/45">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}
