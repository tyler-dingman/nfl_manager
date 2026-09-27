import type { FilterField } from './index';
export const FILM_ROOM_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'press-conferences', label: 'Press Conferences' },
  { id: 'film-room', label: 'Film Room' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'local-shows', label: 'Local Shows' },
  { id: 'player-interviews', label: 'Player Interviews' },
  { id: 'fan-creators', label: 'Fan Creators' },
] as const;
export const FILM_ROOM_FILTERS: readonly FilterField[] = [
  {
    key: 'category',
    label: 'Category',
    defaultValue: 'all',
    options: FILM_ROOM_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
  },
  {
    key: 'order',
    label: 'Sort',
    defaultValue: 'newest',
    options: [
      { value: 'newest', label: 'Newest' },
      { value: 'oldest', label: 'Oldest' },
      { value: 'most-viewed', label: 'Most viewed' },
    ],
  },
];
export function filterFilmVideos<
  T extends {
    category: string;
    publishedAt: string | null;
    addedAt?: string;
    viewCount?: number | null;
  },
>(items: T[], category: string, order: string): T[] {
  const date = (v: T) => {
    const n = Date.parse(v.publishedAt ?? v.addedAt ?? '');
    return Number.isFinite(n) ? n : 0;
  };
  return items
    .filter((v) => category === 'all' || v.category === category)
    .sort((a, b) =>
      order === 'most-viewed'
        ? (b.viewCount ?? -1) - (a.viewCount ?? -1)
        : (date(b) - date(a)) * (order === 'oldest' ? -1 : 1),
    );
}
export function filmPublishedLabel(date: string | null) {
  if (!date || !Number.isFinite(Date.parse(date))) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
