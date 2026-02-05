'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import type { SaveBootstrapDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';

type OnboardingPhase = 'offseason' | 'free_agency' | 'draft';

type TeamWithPreviewCap = TeamDTO & {
  previewCapSpace: number;
};

const ONBOARDING_PHASES: { value: OnboardingPhase; label: string }[] = [
  { value: 'offseason', label: 'Offseason' },
  { value: 'free_agency', label: 'Free Agency' },
  { value: 'draft', label: 'Draft' },
];

const previewCapSpaceFor = (abbr: string): number => {
  const hash = abbr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const normalized = ((hash * 13) % 52) - 6;
  return Number(normalized.toFixed(1));
};

export default function OnboardingPage() {
  const router = useRouter();
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setPhase = useSaveStore((state) => state.setPhase);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const [teams, setTeams] = useState<TeamWithPreviewCap[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<OnboardingPhase>('offseason');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onboardingComplete = window.localStorage.getItem('onboardingComplete') === 'true';
    if (onboardingComplete) {
      router.replace('/');
      return;
    }

    const loadTeams = async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) {
        setError('Unable to load teams. Please refresh and try again.');
        return;
      }

      const data = (await response.json()) as TeamDTO[];
      const withCap = data
        .map((team) => ({
          ...team,
          previewCapSpace: previewCapSpaceFor(team.abbr),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setTeams(withCap);
      if (withCap.length > 0) {
        setSelectedTeam(withCap[0].abbr);
      }
    };

    loadTeams();
  }, [router]);

  const isStartDisabled = useMemo(() => !selectedTeam || isLoading, [isLoading, selectedTeam]);

  const handleStart = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const team = teams.find((item) => item.abbr === selectedTeam);
      if (!team) {
        setError('Please select a team before starting.');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/saves/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.abbr, teamAbbr: team.abbr }),
      });

      if (!response.ok) {
        setError('Unable to create your save right now. Please try again.');
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as SaveBootstrapDTO | { ok: false; error: string };
      if (!('ok' in data) || !data.ok) {
        setError('Unable to create your save right now. Please try again.');
        setIsLoading(false);
        return;
      }

      setSelectedTeamId(team.abbr);
      setSaveHeader({ ...data, phase: selectedPhase }, team.abbr);
      setPhase(selectedPhase);

      window.localStorage.setItem('onboardingComplete', 'true');
      window.localStorage.setItem('onboardingTeamId', team.abbr);
      window.localStorage.setItem('onboardingTeamAbbr', team.abbr);
      window.localStorage.setItem('onboardingPhase', selectedPhase);
      window.localStorage.setItem('onboardingSaveId', data.saveId);

      router.replace('/');
    } catch {
      setError('Unexpected error while starting your save. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold">Welcome to NFL Manager</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick your team and starting phase to set up your first save.
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">1) Select Team</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Choose</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Abbr</th>
                  <th className="px-4 py-3">Cap Space</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.abbr} className="border-t border-border">
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        name="team"
                        value={team.abbr}
                        checked={selectedTeam === team.abbr}
                        onChange={() => setSelectedTeam(team.abbr)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{team.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{team.abbr}</td>
                    <td className="px-4 py-3">${team.previewCapSpace.toFixed(1)}M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">2) Select Starting Phase</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {ONBOARDING_PHASES.map((phase) => (
              <label
                key={phase.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3"
              >
                <input
                  type="radio"
                  name="phase"
                  value={phase.value}
                  checked={selectedPhase === phase.value}
                  onChange={() => setSelectedPhase(phase.value)}
                />
                <span className="font-medium">{phase.label}</span>
              </label>
            ))}
          </div>
        </section>

        {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleStart}
            disabled={isStartDisabled}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Starting...' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
