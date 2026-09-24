'use client';

import { TeamBrandedLogo } from './team-branded-logo';
import type { CSSProperties } from 'react';

import { LogoContainer } from '@/components/branding/logo-container';
import { useTeamStore } from '@/features/team/team-store';
import { cn } from '@/lib/utils';

type FiveWideLogoProps = {
  size?: number;
  imageClassName?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  priority?: boolean;
  teamAbbr?: string | null;
  generic?: boolean;
};

export function FiveWideLogo({
  size = 28,
  imageClassName,
  containerClassName,
  containerStyle,
  teamAbbr,
  generic = false,
}: FiveWideLogoProps) {
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  return (
    <LogoContainer className={containerClassName} style={containerStyle}>
      <TeamBrandedLogo
        team={generic ? null : (teamAbbr ?? selectedTeam?.abbr)}
        width={size * 1.98}
        height={size}
        className={cn('h-auto w-full object-contain', imageClassName)}
        style={{ aspectRatio: generic ? '1601 / 818' : '1594 / 806' }}
      />
    </LogoContainer>
  );
}
