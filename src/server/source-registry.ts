import { getAllSources, type SourceDefinition } from '@/data/sources';

const registry = new Map(getAllSources().map((source) => [source.id, source]));

export const listRegisteredSources = (team?: string | null) =>
  [...registry.values()]
    .filter((source) => !team || source.team === null || source.team === team.toUpperCase())
    .sort(
      (left, right) =>
        right.priority - left.priority || left.displayName.localeCompare(right.displayName),
    );

export const updateRegisteredSource = (
  id: string,
  changes: Partial<SourceDefinition>,
): SourceDefinition | null => {
  const current = registry.get(id);
  if (!current) return null;
  const updated = { ...current, ...changes, id: current.id };
  registry.set(id, updated);
  return updated;
};

export const addRegisteredSource = (source: SourceDefinition) => {
  if (registry.has(source.id)) throw new Error(`Source ${source.id} already exists`);
  registry.set(source.id, source);
  return source;
};
