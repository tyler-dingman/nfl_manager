import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortState } from './parlay-table';
import styles from './parlay-sort-header.module.css';

export default function ParlaySortHeader<Key extends string>({
  label,
  sortKey,
  sort,
  onSort,
  title,
  as: Tag = 'span',
}: {
  label: string;
  sortKey: Key;
  sort: SortState<Key>;
  onSort: (key: Key) => void;
  title?: string;
  as?: 'span' | 'th';
}) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  return (
    <Tag
      role="columnheader"
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
      title={title}
    >
      <button className={styles.button} type="button" onClick={() => onSort(sortKey)}>
        {label}
        {direction === 'asc' ? (
          <ArrowUp />
        ) : direction === 'desc' ? (
          <ArrowDown />
        ) : (
          <ChevronsUpDown />
        )}
      </button>
    </Tag>
  );
}
