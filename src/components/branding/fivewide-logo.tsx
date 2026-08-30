'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

import { LogoContainer } from '@/components/branding/logo-container';
import { useTeamStore } from '@/features/team/team-store';
import { getTeamBrandedLogoUrl } from '@/lib/team-brand-themes';
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
  priority = false,
  teamAbbr,
  generic = false,
}: FiveWideLogoProps) {
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const logoUrl = generic
    ? '/images/down_distance_badge.png'
    : getTeamBrandedLogoUrl(teamAbbr ?? selectedTeam?.abbr);

  return (
    <LogoContainer className={containerClassName} style={containerStyle}>
      <Image
        src={logoUrl}
        alt="Down & Distance"
        width={size * 1.98}
        height={size}
        className={cn('h-auto w-full object-contain', imageClassName)}
        priority={priority}
      />
    </LogoContainer>
  );
}
