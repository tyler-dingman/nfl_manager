'use client';

import { useId, type SVGProps } from 'react';
import { getTeamLogoColors } from '@/lib/branding/team-logo-colors';
import { LOGO_CLIPS, LOGO_PATHS, LOGO_REGIONS } from '@/lib/branding/team-logo-regions';
import { LOGO_VIEW_BOX } from '@/lib/branding/team-logo-paths';

export function TeamBrandedLogo({
  team,
  ...props
}: SVGProps<SVGSVGElement> & { team?: string | null }) {
  const id = useId().replaceAll(':', '');
  const colors = getTeamLogoColors(team);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Down & Distance"
      {...props}
      viewBox={LOGO_VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {Object.entries(LOGO_CLIPS).map(([name, rect]) => (
          <clipPath key={name} id={`${id}-${name}`}>
            <rect {...rect} />
          </clipPath>
        ))}
      </defs>
      <g>
        {LOGO_REGIONS.map(({ path, color, clip }, index) => (
          <path
            key={index}
            data-logo-region={color}
            d={LOGO_PATHS[path].d}
            fill={colors[color]}
            clipPath={clip ? `url(#${id}-${clip})` : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
