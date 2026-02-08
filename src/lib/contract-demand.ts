import { getApyCapForPosition } from '@/lib/contract-negotiation';

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

export const getDemandAavMillions = ({
  position,
  ovr,
}: {
  position: string;
  ovr: number;
}): number => {
  const cap = getApyCapForPosition(position);
  if (ovr >= 90) return roundToTenth(cap * 0.95);
  if (ovr >= 85) return roundToTenth(cap * 0.8);
  if (ovr >= 80) return roundToTenth(cap * 0.7);
  if (ovr >= 75) return roundToTenth(cap * 0.4);
  if (ovr >= 70) return roundToTenth(cap * 0.32); // TODO: spec said 320%; using 32% as assumed.
  if (ovr >= 65) return 1;
  return 1;
};

if (process.env.NODE_ENV !== 'production') {
  console.assert(getDemandAavMillions({ position: 'QB', ovr: 90 }) === 57);
  console.assert(getDemandAavMillions({ position: 'QB', ovr: 89 }) === 48);
  console.assert(getDemandAavMillions({ position: 'WR', ovr: 86 }) === 28);
  console.assert(getDemandAavMillions({ position: 'WR', ovr: 84 }) === 24.5);
  console.assert(getDemandAavMillions({ position: 'EDGE', ovr: 82 }) === 28);
  console.assert(getDemandAavMillions({ position: 'LT', ovr: 77 }) === 10);
  console.assert(getDemandAavMillions({ position: 'LT', ovr: 74 }) === 8);
  console.assert(getDemandAavMillions({ position: 'S', ovr: 72 }) === 6.4);
  console.assert(getDemandAavMillions({ position: 'RB', ovr: 67 }) === 1);
  console.assert(getDemandAavMillions({ position: 'RB', ovr: 64 }) === 1);
}
