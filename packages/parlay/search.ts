/** Match partial names consistently across web and native, ignoring punctuation and accents. */
export function matchesPropSearch(text: string | null | undefined, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’.-]/g, '')
      .trim();
  const candidate = normalize(text ?? '');
  return normalize(query)
    .split(/\s+/)
    .every((part) => candidate.includes(part));
}
