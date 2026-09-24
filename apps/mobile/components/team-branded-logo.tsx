import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect, type SvgProps } from 'react-native-svg';
import { getTeamLogoColors } from '../../../src/lib/branding/team-logo-colors';
import { LOGO_CLIPS, LOGO_PATHS, LOGO_REGIONS } from '../../../src/lib/branding/team-logo-regions';
import { LOGO_VIEW_BOX } from '../../../src/lib/branding/team-logo-paths';

export function TeamBrandedLogo({ team, ...props }: SvgProps & { team?: string | null }) {
  const id = useId().replaceAll(':', '');
  const colors = getTeamLogoColors(team);
  return (
    <Svg
      accessibilityRole="image"
      accessibilityLabel="Down & Distance"
      {...props}
      viewBox={LOGO_VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
    >
      <Defs>
        {Object.entries(LOGO_CLIPS).map(([name, rect]) => (
          <ClipPath key={name} id={`${id}-${name}`}>
            <Rect {...rect} />
          </ClipPath>
        ))}
      </Defs>
      <G>
        {LOGO_REGIONS.map(({ path, color, clip }, index) => (
          <Path
            key={index}
            d={LOGO_PATHS[path].d}
            fill={colors[color]}
            clipPath={clip ? `url(#${id}-${clip})` : undefined}
          />
        ))}
      </G>
    </Svg>
  );
}
