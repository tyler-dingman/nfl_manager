'use client';
import { useEffect, useRef, useState, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import styles from './responsive-player-table.module.css';
/** Keeps the original controlled select and its real change event as the single source of truth. */
export function ResponsivePlayerSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const ref = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const label = props['aria-label'] ?? 'Choose filter';
  const [options, setOptions] = useState<HTMLOptionElement[]>([]);
  useEffect(() => {
    if (ref.current) setOptions(Array.from(ref.current.options));
  }, [props.children, props.value]);
  const selected = options.find((o) => o.value === String(props.value ?? props.defaultValue));
  return (
    <>
      <select {...props} ref={ref} className={`${props.className ?? ''} ${styles.desktopRow}`} />
      <button
        type="button"
        disabled={props.disabled}
        className={`${styles.select} ${styles.mobileRow}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{selected?.text || label}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <BottomSheet title={label} onClose={() => setOpen(false)}>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              disabled={option.disabled}
              aria-pressed={option.selected}
              onClick={() => {
                if (ref.current) {
                  ref.current.value = option.value;
                  ref.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
                setOpen(false);
              }}
            >
              {option.text}
              {option.selected && <Check size={16} />}
            </button>
          ))}
        </BottomSheet>
      )}
    </>
  );
}
