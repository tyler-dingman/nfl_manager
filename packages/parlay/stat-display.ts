/** Consistent stat-bar grouping across server, browser and native locales. */
export function formatStatValue(value: number | string | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString('en-US') : (value ?? '—');
}
