import type { PlayerRowDTO } from '@/types/player';

export type FalcoTag =
  | 'Falco Rising'
  | 'Falco Fading'
  | 'Falco Concern'
  | 'Falco Favorite'
  | 'Boom/Bust'
  | 'High Floor'
  | 'Scheme Fit'
  | 'Injury Flag'
  | 'Character Flag';

export type FalcoNote = {
  playerId: string;
  tag: FalcoTag;
  blurb: string;
  delta: number;
  createdAt: string;
};

export type FalcoTweet = {
  id: string;
  body: string;
  createdAt: string;
  tone: 'hype' | 'skeptical' | 'value' | 'concern';
  playerId?: string;
};

export const falcoProfile = {
  name: 'Falco',
  tagline: 'Built from tape, traits, and truth.',
};

type ProspectDTO = Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName' | 'position' | 'rank'>;

const baseDate = new Date('2026-02-06T12:00:00Z');

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const createRng = (seed: string) => {
  let value = hashString(seed) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sample = <T>(rng: () => number, items: T[]) =>
  items[Math.floor(rng() * items.length)] ?? items[0];

const pickTag = (rng: () => number, delta: number): FalcoTag => {
  if (delta >= 3) return sample(rng, ['Falco Rising', 'Falco Favorite', 'High Floor']);
  if (delta <= -3) return sample(rng, ['Falco Fading', 'Falco Concern', 'Boom/Bust']);
  return sample(rng, ['Scheme Fit', 'High Floor', 'Falco Favorite']);
};

const noteTemplates = {
  rising: [
    '{name} is climbing fast — traits are catching up to the tape.',
    'The league’s whispers are louder on {name}. Moving up.',
    '{name} keeps stacking high-end reps. Stock trending up.',
  ],
  fading: [
    '{name} has to answer some fit questions. Sliding a bit.',
    'The floor feels lower on {name}. Teams are split.',
    '{name} is talented, but the board is moving around him.',
  ],
  steady: [
    '{name} is steady. You know what you’re getting.',
    '{name} fits cleanly. Solid mid-round value.',
    'The grade on {name} hasn’t moved — reliable tape.',
  ],
  concern: [
    '{name} comes with a real risk flag in the room.',
    'Teams want clarity before betting on {name}.',
    '{name} is a swing pick — not for everyone.',
  ],
};

const tweetTemplates = {
  hype: [
    'Falco: {name} is a problem. Long, explosive, and just getting started.',
    'Falco: {name} has first-round tape all day. Tape doesn’t lie.',
    'Falco: Don’t overthink {name}. He’s a tone-setter.',
  ],
  skeptical: [
    'Falco: I like {name}, but I’m not sure the ceiling is real.',
    'Falco: The traits are loud. The polish is not.',
    'Falco: {name} might need more time than people want to admit.',
  ],
  value: [
    'Falco: If {name} gets to your pick, it’s value.',
    'Falco: {name} is the kind of board win you remember.',
    'Falco: The market is sleeping on {name}.',
  ],
  concern: [
    'Falco: I’m hearing mixed on {name}. Watch the medicals.',
    'Falco: There’s a real risk profile with {name}.',
    'Falco: {name} can be great, but there’s volatility here.',
  ],
};

const positionGroup = (position: string) => {
  if (['OT', 'IOL', 'OL', 'OG', 'C'].includes(position)) return 'OL';
  if (['DL', 'DT', 'EDGE'].includes(position)) return 'DL';
  return position;
};

const requiredGroups = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];

export const formatFalcoDelta = (delta: number) => {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return '—';
};

export const falcoToneStyles = (tone: FalcoTweet['tone']) => {
  switch (tone) {
    case 'hype':
      return 'bg-emerald-100 text-emerald-700';
    case 'value':
      return 'bg-blue-100 text-blue-700';
    case 'concern':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export const buildFalcoBoard = (
  prospects: ProspectDTO[],
  seed = 'falco-board',
): { notes: FalcoNote[]; tweets: FalcoTweet[] } => {
  const rng = createRng(seed);
  const grouped = new Map<string, ProspectDTO[]>();
  prospects.forEach((prospect) => {
    const group = positionGroup(prospect.position);
    const list = grouped.get(group) ?? [];
    list.push(prospect);
    grouped.set(group, list);
  });

  const notes: FalcoNote[] = [];
  requiredGroups.forEach((group) => {
    const groupProspects = grouped.get(group);
    if (!groupProspects?.length) {
      return;
    }
    const prospect = sample(rng, groupProspects);
    const delta = sample(rng, [-5, -3, -2, 0, 0, 2, 3, 5]);
    const tag = pickTag(rng, delta);
    const name = `${prospect.firstName} ${prospect.lastName}`.trim();
    const template =
      delta >= 3
        ? sample(rng, noteTemplates.rising)
        : delta <= -3
          ? sample(rng, noteTemplates.fading)
          : sample(rng, noteTemplates.steady);
    notes.push({
      playerId: prospect.id,
      tag,
      blurb: template.replace('{name}', name),
      delta,
      createdAt: new Date(baseDate.getTime() - rng() * 1000 * 60 * 60).toISOString(),
    });
  });

  const targetCount = Math.floor(rng() * 6) + 9;
  const pool = prospects.slice();
  while (notes.length < targetCount && pool.length) {
    const prospect = sample(rng, pool);
    const delta = sample(rng, [-4, -2, 0, 2, 4]);
    const tag = pickTag(rng, delta);
    const name = `${prospect.firstName} ${prospect.lastName}`.trim();
    const template =
      tag === 'Falco Concern' || tag === 'Injury Flag' || tag === 'Character Flag'
        ? sample(rng, noteTemplates.concern)
        : delta >= 3
          ? sample(rng, noteTemplates.rising)
          : delta <= -3
            ? sample(rng, noteTemplates.fading)
            : sample(rng, noteTemplates.steady);
    notes.push({
      playerId: prospect.id,
      tag,
      blurb: template.replace('{name}', name),
      delta,
      createdAt: new Date(baseDate.getTime() - rng() * 1000 * 60 * 90).toISOString(),
    });
  }

  const tweetCount = Math.floor(rng() * 9) + 10;
  const tones: FalcoTweet['tone'][] = ['hype', 'skeptical', 'value', 'concern'];
  const tweets: FalcoTweet[] = [];
  for (let i = 0; i < tweetCount; i += 1) {
    const prospect = sample(rng, prospects);
    const tone = sample(rng, tones);
    const template = sample(rng, tweetTemplates[tone]);
    const name = `${prospect.firstName} ${prospect.lastName}`.trim();
    tweets.push({
      id: `falco-${seed}-${i}`,
      body: template.replace('{name}', name),
      createdAt: new Date(baseDate.getTime() - rng() * 1000 * 60 * 120).toISOString(),
      tone,
      playerId: prospect.id,
    });
  }

  return { notes, tweets };
};
