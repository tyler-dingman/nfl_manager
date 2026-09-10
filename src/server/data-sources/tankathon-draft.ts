export const TANKATHON_DRAFT_URL = 'https://www.tankathon.com/nfl/big-board';

export const DRAFT_POSITIONS = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OT',
  'IOL',
  'DL',
  'EDGE',
  'LB',
  'CB',
  'S',
] as const;

export type TankathonProspect = {
  sourceRank: number;
  name: string;
  position: (typeof DRAFT_POSITIONS)[number];
  school: string;
  height: string | null;
  weight: number | null;
  schoolLogo: string | null;
  profileUrl: string | null;
};

export type TankathonDraftBoard = {
  draftYear: number;
  sourceUpdatedAt: string;
  fetchedAt: string;
  prospects: TankathonProspect[];
};

const decodeHtml = (value: string) =>
  value
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replace(/<[^>]+>/g, '')
    .trim();

const normalizePosition = (value: string): TankathonProspect['position'] | null => {
  const position = value.trim().toUpperCase().split('/')[0];
  if (position === 'DI' || position === 'DT' || position === 'IDL') return 'DL';
  if (position === 'DE' || position === 'ED') return 'EDGE';
  if (position === 'C' || position === 'G' || position === 'OG') return 'IOL';
  if (position === 'T') return 'OT';
  return DRAFT_POSITIONS.includes(position as TankathonProspect['position'])
    ? (position as TankathonProspect['position'])
    : null;
};

const capture = (html: string, pattern: RegExp) => pattern.exec(html)?.[1] ?? null;

export const parseTankathonDraftBoard = (
  html: string,
  fetchedAt = new Date().toISOString(),
): TankathonDraftBoard => {
  const year = Number(capture(html, /<h1[^>]*>\s*(\d{4}) NFL Draft Big Board\s*<\/h1>/i));
  const updated = capture(html, /Player Rankings updated\s*<time datetime="([^"]+)"/i);
  const start = html.indexOf('<div id="big-board"');
  const end = html.indexOf('<div id="big-board-by-school"', start);
  if (!Number.isInteger(year) || start < 0 || end < 0) {
    throw new Error('Tankathon Draft Board markup was not recognized.');
  }

  const section = html.slice(start, end);
  const rows = section.split(/<div class="mock-row nfl"[^>]*>/i).slice(1);
  const prospects = rows.flatMap((row): TankathonProspect[] => {
    const sourceRank = Number(capture(row, /mock-row-pick-number[^>]*>\s*(\d+)\s*</i));
    const name = decodeHtml(capture(row, /mock-row-name[^>]*>([\s\S]*?)<\/div>/i) ?? '');
    const schoolPosition = decodeHtml(
      capture(row, /mock-row-school-position[^>]*>([\s\S]*?)<\/div>/i) ?? '',
    );
    const [rawPosition = '', rawSchool = ''] = schoolPosition
      .split('|')
      .map((value) => value.trim());
    const position = normalizePosition(rawPosition);
    const school = rawSchool.trim();
    const measurementMatch =
      /section height-weight[^>]*>\s*<div>([\s\S]*?)<\/div>\s*<div>(\d{3})/i.exec(row);
    const height = measurementMatch ? decodeHtml(measurementMatch[1]) : null;
    const schoolLogo = capture(row, /mock-row-logo[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const profilePath = capture(row, /mock-row-player[\s\S]*?<a[^>]+href="([^"]+)"/i);

    if (!Number.isInteger(sourceRank) || sourceRank < 1 || !name || !school || !position) return [];
    return [
      {
        sourceRank,
        name,
        position,
        school,
        height,
        weight: measurementMatch ? Number(measurementMatch[2]) : null,
        schoolLogo: schoolLogo?.replace(/^http:/, 'https:') ?? null,
        profileUrl: profilePath ? new URL(profilePath, TANKATHON_DRAFT_URL).toString() : null,
      },
    ];
  });

  const unique = [
    ...new Map(prospects.map((prospect) => [prospect.sourceRank, prospect])).values(),
  ].sort((left, right) => left.sourceRank - right.sourceRank);
  validateTankathonDraftBoard(year, unique);
  return { draftYear: year, sourceUpdatedAt: updated ?? fetchedAt, fetchedAt, prospects: unique };
};

export const validateTankathonDraftBoard = (year: number, prospects: TankathonProspect[]) => {
  if (year !== 2027) throw new Error(`Expected the 2027 Draft class, received ${year}.`);
  if (prospects.length < 100) throw new Error(`Draft Board is too small (${prospects.length}).`);
  if (prospects[0]?.sourceRank !== 1) throw new Error('Draft Board does not include rank No. 1.');
  if (
    new Set(prospects.map((prospect) => prospect.name.toLowerCase())).size <
    prospects.length * 0.95
  ) {
    throw new Error('Draft Board contains too many duplicate players.');
  }
};
