/** Framework-free contract shared by the web and Expo filter controls. */
export type FilterField = {
  key: string;
  label: string;
  defaultValue: string;
  options: readonly { value: string; label: string }[];
};
export type FilterValues = Record<string, string>;
export type MobileFilterProps = {
  primary: readonly FilterField[];
  secondary: readonly FilterField[];
  values: FilterValues;
  onChange: (changes: FilterValues) => void;
};
export const BEAT_PRIMARY: readonly FilterField[] = [
  {
    key: 'type',
    label: 'Category',
    defaultValue: 'ALL',
    options: [
      { value: 'ALL', label: 'All' },
      { value: 'HOT', label: 'Hot Reads' },
      { value: 'ROSTER', label: 'Roster' },
      { value: 'INJURIES', label: 'Injuries' },
      { value: 'DRAFT', label: 'Draft' },
      { value: 'GAMES', label: 'Games' },
    ],
  },
  {
    key: 'sort',
    label: 'Sort',
    defaultValue: 'UPDATED',
    options: [
      { value: 'UPDATED', label: 'Recently updated' },
      { value: 'NEWEST', label: 'Newest' },
    ],
  },
];
export const BEAT_SECONDARY: readonly FilterField[] = [
  {
    key: 'range',
    label: 'Time',
    defaultValue: 'ALL',
    options: [
      { value: 'ALL', label: 'All time' },
      { value: 'TODAY', label: 'Today' },
      { value: 'WEEK', label: 'This week' },
      { value: 'MONTH', label: 'This month' },
    ],
  },
];
export function filterValue(field: FilterField, values: FilterValues) {
  return field.options.some((o) => o.value === values[field.key])
    ? values[field.key]
    : field.defaultValue;
}
export function filterLabel(field: FilterField, values: FilterValues) {
  return field.options.find((o) => o.value === filterValue(field, values))!.label;
}
export const resetFilters = (fields: readonly FilterField[]) =>
  Object.fromEntries(fields.map((f) => [f.key, f.defaultValue]));
export const activeFilterCount = (fields: readonly FilterField[], values: FilterValues) =>
  fields.filter((f) => filterValue(f, values) !== f.defaultValue).length;
export const FILTER_TOUCH_SIZE = 44;
