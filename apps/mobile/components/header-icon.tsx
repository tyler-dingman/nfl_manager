import Svg, { Circle, Path } from 'react-native-svg';

/** Same 24-unit geometry and sizing as web football-icons header controls. */
export function HeaderIcon({ name }: { name: 'search' | 'bell' | 'menu' }) {
  const size = name === 'menu' ? 20 : 16;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {name === 'search' ? <><Circle cx={10} cy={10} r={6.5} /><Path d="M15 15L21 21" /></> :
        <Path d={name === 'menu' ? 'M3 5H21 M3 12H21 M3 19H21' : 'M4 18L6 14V9C6 1 18 1 18 9V14L20 18Z M9 21Q12 24 15 21 M12 2V3'} />}
    </Svg>
  );
}
