'use client';

import { useEffect, useMemo, useState } from 'react';
import ProfileLayout from '@/components/auth/profile-navigation';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useProfileTeam } from '@/features/team/use-profile-team';
import { useTeamStore } from '@/features/team/team-store';

import { RewardsDashboard } from './rewards-dashboard';
import type { RewardDashboard as Dashboard } from '../../../packages/rewards/presentation';

export default function RewardsPage() {
  const teams = useTeamStore((state) => state.teams);
  const [teamAbbr] = useProfileTeam();
  const team = useMemo(
    () => teams.find((candidate) => candidate.abbr === teamAbbr),
    [teamAbbr, teams],
  );
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState<string | null>(null);
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
    void load();
  }, []);
  const claim = async (id: string) => {
    if (claiming) return;
    setClaiming(id);
    setError('');
    try {
      const response = await fetch(`/api/rewards/${id}/claim`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to claim reward.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to claim reward.');
    } finally {
      setClaiming(null);
    }
  };
  if (teamAbbr === undefined) return <div className="min-h-screen bg-[#f7f4ee]" />;
  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <MainSiteHeader teamAbbr={team?.abbr} active={null} />
        <ProfileLayout>
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-white p-4 text-red-700">
              {error}
            </p>
          )}
          {data ? (
            <RewardsDashboard
              data={data}
              teamAbbr={teamAbbr ?? 'NFL'}
              claim={(id) => void claim(id)}
              claiming={claiming}
            />
          ) : (
            !error && (
              <p role="status" className="p-6">
                Loading your rewards…
              </p>
            )
          )}
        </ProfileLayout>
      </div>
    </TeamThemeProvider>
  );
}
