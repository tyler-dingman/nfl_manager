'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Settings2 } from 'lucide-react';
import {
  activeFilterCount,
  filterLabel,
  filterValue,
  resetFilters,
  type MobileFilterProps,
  type FilterValues,
} from '../../../packages/filters';
import { FilterBottomSheet } from './filter-bottom-sheet';
import styles from './responsive-filter-bar.module.css';

export function ResponsiveFilterBar({
  primary,
  secondary,
  values,
  onChange,
  children,
}: MobileFilterProps & { children: ReactNode }) {
  const [headerHeight, setHeaderHeight] = useState<number>();
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<FilterValues>({});
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const close = () => {
      if (media.matches) setOpen(null);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  const count = activeFilterCount(secondary, values);
  const fields = open === 'secondary' ? secondary : primary.filter((f) => f.key === open);
  return (
    <>
      <div className={styles.desktop}>{children}</div>
      <div
        className={styles.mobile}
        style={headerHeight === undefined ? undefined : { top: headerHeight }}
        role="group"
        aria-label="Feed filters"
      >
        {primary.map((field) => (
          <button
            key={field.key}
            aria-haspopup="dialog"
            aria-expanded={open === field.key}
            aria-label={`${field.label}: ${filterLabel(field, values)}`}
            onClick={() => setOpen(field.key)}
          >
            <span>{filterLabel(field, values)}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        ))}
        {secondary.length > 0 && (
          <button
            aria-haspopup="dialog"
            aria-expanded={open === 'secondary'}
            aria-label={`Filters${count ? `, ${count} active` : ''}`}
            onClick={() => {
              setDraft(Object.fromEntries(secondary.map((f) => [f.key, filterValue(f, values)])));
              setOpen('secondary');
            }}
          >
            <span>Filters{count ? ` · ${count}` : ''}</span>
            <Settings2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <FilterBottomSheet
          title={open === 'secondary' ? 'Filters' : (fields[0]?.label ?? 'Filters')}
          onClose={() => setOpen(null)}
          footer={
            open === 'secondary' ? (
              <>
                <button onClick={() => setDraft(resetFilters(secondary))}>Reset</button>
                <button
                  className={styles.apply}
                  onClick={() => {
                    onChange(draft);
                    setOpen(null);
                  }}
                >
                  Apply
                </button>
              </>
            ) : undefined
          }
        >
          {fields.map((field) => (
            <fieldset key={field.key}>
              <legend>{field.label}</legend>
              {field.options.map((option) => {
                const selected =
                  filterValue(field, open === 'secondary' ? draft : values) === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (open === 'secondary')
                        setDraft((d) => ({ ...d, [field.key]: option.value }));
                      else {
                        onChange({ [field.key]: option.value });
                        setOpen(null);
                      }
                    }}
                  >
                    {option.label}
                    {selected && <Check size={18} aria-hidden="true" />}
                  </button>
                );
              })}
            </fieldset>
          ))}
        </FilterBottomSheet>
      )}
    </>
  );
}
