import type { ImageSourcePropType } from 'react-native';
import { getTeamBrandTheme } from '../../../src/lib/team-brand-themes';
import { useTeam } from './team-context';

const DEFAULT_LOGO = require('../../../public/images/down_distance_badge.png') as ImageSourcePropType;
const TEAM_LOGOS: Record<string, ImageSourcePropType> = {
  ARI: require('../../../public/images/team_branded_logos/down-distance-arizona-cardinals.png'),
  ATL: require('../../../public/images/team_branded_logos/down-distance-atlanta-falcons.png'),
  BAL: require('../../../public/images/team_branded_logos/down-distance-baltimore-ravens.png'),
  BUF: require('../../../public/images/team_branded_logos/down-distance-buffalo-bills.png'),
  CAR: require('../../../public/images/team_branded_logos/down-distance-carolina-panthers.png'),
  CHI: require('../../../public/images/team_branded_logos/down-distance-chicago-bears.png'),
  CIN: require('../../../public/images/team_branded_logos/down-distance-cincinnati-bengals.png'),
  CLE: require('../../../public/images/team_branded_logos/down-distance-cleveland-browns.png'),
  DAL: require('../../../public/images/team_branded_logos/down-distance-dallas-cowboys.png'),
  DEN: require('../../../public/images/team_branded_logos/down-distance-denver-broncos.png'),
  DET: require('../../../public/images/team_branded_logos/down-distance-detroit-lions.png'),
  GB: require('../../../public/images/team_branded_logos/down-distance-green-bay-packers.png'),
  HOU: require('../../../public/images/team_branded_logos/down-distance-houston-texans.png'),
  IND: require('../../../public/images/team_branded_logos/down-distance-indianapolis-colts.png'),
  JAX: require('../../../public/images/team_branded_logos/down-distance-jacksonville-jaguars.png'),
  KC: require('../../../public/images/team_branded_logos/down-distance-kansas-city-chiefs.png'),
  LV: require('../../../public/images/team_branded_logos/down-distance-las-vegas-raiders.png'),
  LAC: require('../../../public/images/team_branded_logos/down-distance-los-angeles-chargers.png'),
  LAR: require('../../../public/images/team_branded_logos/down-distance-los-angeles-rams.png'),
  MIA: require('../../../public/images/team_branded_logos/down-distance-miami-dolphins.png'),
  MIN: require('../../../public/images/team_branded_logos/down-distance-minnesota-vikings.png'),
  NE: require('../../../public/images/team_branded_logos/down-distance-new-england-patriots.png'),
  NO: require('../../../public/images/team_branded_logos/down-distance-new-orleans-saints.png'),
  NYG: require('../../../public/images/team_branded_logos/down-distance-new-york-giants.png'),
  NYJ: require('../../../public/images/team_branded_logos/down-distance-new-york-jets.png'),
  PHI: require('../../../public/images/team_branded_logos/down-distance-philadelphia-eagles.png'),
  PIT: require('../../../public/images/team_branded_logos/down-distance-pittsburgh-steelers.png'),
  SF: require('../../../public/images/team_branded_logos/down-distance-san-francisco-49ers.png'),
  SEA: require('../../../public/images/team_branded_logos/down-distance-seattle-seahawks.png'),
  TB: require('../../../public/images/team_branded_logos/down-distance-tampa-bay-buccaneers.png'),
  TEN: require('../../../public/images/team_branded_logos/down-distance-tennessee-titans.png'),
  WAS: require('../../../public/images/team_branded_logos/down-distance-washington-commanders.png'),
};

export function useTeamBranding() {
  const { teamId } = useTeam();
  const theme = getTeamBrandTheme(teamId);

  return {
    teamId,
    theme,
    logoSource: TEAM_LOGOS[teamId.toUpperCase()] ?? DEFAULT_LOGO,
  };
}
