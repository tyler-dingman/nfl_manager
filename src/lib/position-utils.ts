const POSITION_ABBR_MAP: Record<string, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  EDGE: 'ED',
  DL: 'DL',
  DT: 'DT',
  CB: 'CB',
  LB: 'LB',
  S: 'SS',
  SS: 'SS',
  FS: 'FS',
  OL: 'OL',
  OT: 'OT',
  OG: 'OG',
  C: 'CE',
  IOL: 'IO',
  P: 'P',
  K: 'K',
};

export const toTwoLetterPosition = (position: string) =>
  POSITION_ABBR_MAP[position?.toUpperCase()] ?? position?.slice(0, 2)?.toUpperCase() ?? '—';
