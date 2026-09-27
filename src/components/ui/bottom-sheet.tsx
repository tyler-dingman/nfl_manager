'use client';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import styles from '../filters/responsive-filter-bar.module.css';

export function BottomSheet({
  title,
  onClose,
  children,
  footer,
  closeLabel = 'Close sheet',
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  useDialogFocus(true, ref, onClose);
  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`${styles.sheet} ${className}`}
      >
        <header>
          <h2 id={id}>{title}</h2>
          <button onClick={onClose} aria-label={closeLabel}>
            <X size={20} />
          </button>
        </header>
        <div className={styles.options}>{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
