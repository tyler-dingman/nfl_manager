'use client';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { LAB_SCORE_CONFIG, LAB_SCORE_SCALE_NOTE } from '../../../packages/parlay/lab-score-config';
import styles from './lab-score-help.module.css';
function Guide({ close }: { close: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  useDialogFocus(true, ref, close);
  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={styles.dialog}
      >
        <header>
          <h2 id={id}>Lab Score Guide</h2>
          <button type="button" aria-label="Close Lab Score Guide" onClick={close}>
            <X size={20} />
          </button>
        </header>
        <dl>
          {LAB_SCORE_CONFIG.bands.map((t) => (
            <div key={t.min}>
              <dt>
                {t.range} · {t.label}
              </dt>
              <dd>{t.description}</dd>
            </div>
          ))}
        </dl>
        <p>Research strength, not win probability. {LAB_SCORE_SCALE_NOTE}</p>
      </section>
    </div>,
    document.body,
  );
}
export function LabScoreHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.info}
        title="Lab Score Guide"
        aria-label="Open Lab Score Guide"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.focus();
          setOpen(true);
        }}
      >
        <Info size={15} />
      </button>
      {open && <Guide close={() => setOpen(false)} />}
    </>
  );
}
