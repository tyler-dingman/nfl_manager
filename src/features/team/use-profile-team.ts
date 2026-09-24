'use client';

import { useLayoutEffect, useState } from 'react';
import { readCanonicalFanTeamPreference, readFanTeamPreference } from './fan-team-preference';

/** Restore the saved theme before paint; never show generic branding while resolving it. */
export function useProfileTeam() {
  const [teamAbbr, setTeamAbbr] = useState<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    let active = true;
    const savedTeam = readFanTeamPreference();
    if (savedTeam) setTeamAbbr(savedTeam);
    void readCanonicalFanTeamPreference().then((team) => {
      if (active) setTeamAbbr(team);
    });
    return () => {
      active = false;
    };
  }, []);
  return [teamAbbr, setTeamAbbr] as const;
}
