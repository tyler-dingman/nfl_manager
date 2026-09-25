'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTeamStore } from '@/features/team/team-store';
import {
  readCanonicalFanTeamPreference,
  readFanTeamPreference,
} from '@/features/team/fan-team-preference';
export function useParlayTeamContext() {
  const searchParams = useSearchParams();
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const [fanTeam, setFanTeam] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setFanTeam(readFanTeamPreference());
    void readCanonicalFanTeamPreference().then((team) => {
      if (active) {
        setFanTeam(team);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const favorite =
    teams.find((t) => t.abbr === fanTeam) ?? teams.find((t) => t.id === selectedTeamId) ?? teams[0];
  const team = teams.find((t) => t.abbr === searchParams?.get('team')?.toUpperCase()) ?? favorite;
  return { team, favorite, ready };
}
export function useParlayTeam() {
  return useParlayTeamContext().team;
}
