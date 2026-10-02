import geometry from '../../public/assets/huddle-field-aligned/geometry.json';
export const FIELD_WIDTH = geometry.base_width;
export const FIELD_HEIGHT = geometry.base_height;
export const FIELD_BASE_ASSET = '/assets/huddle-field-assets/base_field.png';
export const FIELD_TEAMS = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LAC',
  'LAR',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WAS',
] as const;
export function getHuddleEndZoneAsset(team: string, side: 'left' | 'right') {
  const abbr = team.toUpperCase();
  return (FIELD_TEAMS as readonly string[]).includes(abbr)
    ? `/assets/huddle-field-aligned/endzones/${abbr}/${side}.png`
    : null;
}
export const FIELD_TOP = geometry.left_endzone_polygon[1][1];
export const FIELD_BOTTOM = geometry.left_endzone_polygon[2][1];
export const FIELD_GOALS = {
  leftTop: geometry.left_endzone_polygon[1][0],
  leftBottom: geometry.left_endzone_polygon[2][0],
  rightTop: geometry.right_endzone_polygon[0][0],
  rightBottom: geometry.right_endzone_polygon[3][0],
};
