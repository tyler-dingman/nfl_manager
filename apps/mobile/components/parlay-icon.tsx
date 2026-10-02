import { SvgXml } from 'react-native-svg';
import icons from '../lib/parlay-icon-assets.json';

/** Uses the same public/assets/parlay-lab-science-icons geometry as web. */
export function ParlayIcon({ name, color = '#f4f8fc', size = 24 }: {
  name: keyof typeof icons; color?: string; size?: number;
}) {
  return <SvgXml xml={icons[name].replaceAll('#071F33', color)} width={size} height={size} />;
}
