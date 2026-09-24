const aliases: Record<string, string> = {
  T: 'OT',
  LT: 'OT',
  RT: 'OT',
  G: 'IOL',
  OG: 'IOL',
  C: 'IOL',
  LG: 'IOL',
  RG: 'IOL',
  DT: 'DL',
  NT: 'DL',
  DE: 'EDGE',
  ED: 'EDGE',
  ILB: 'LB',
  MLB: 'LB',
  OLB: 'LB',
  FS: 'S',
  SS: 'S',
};
const positions = new Set([
  'QB',
  'RB',
  'FB',
  'WR',
  'TE',
  'OT',
  'IOL',
  'OL',
  'DL',
  'EDGE',
  'LB',
  'CB',
  'S',
  'K',
  'P',
  'LS',
]);
export function draftPositionFilter(value: string | null | undefined): string {
  const token = value?.trim().toUpperCase() ?? 'ALL';
  const normalized = aliases[token] ?? token;
  return positions.has(normalized) ? normalized : 'ALL';
}
export function matchesDraftPosition(position: string | null, filter: string): boolean {
  if (filter === 'ALL') return true;
  return (position ?? '').split('/').some((part) => {
    const normalized = draftPositionFilter(part);
    return filter === 'OL' ? ['OT', 'IOL', 'OL'].includes(normalized) : normalized === filter;
  });
}
