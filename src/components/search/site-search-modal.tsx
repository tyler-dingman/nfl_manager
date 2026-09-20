'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TEAM_LIST } from '@/data/teams';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import AiSearchPanel from './ai-search-panel';

export default function SiteSearchModal({
  open,
  onClose,
  teamAbbr,
}: {
  open: boolean;
  onClose: () => void;
  teamAbbr?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  useDialogFocus(open, ref, onClose);
  const team = TEAM_LIST.find((item) => item.abbr === teamAbbr?.toUpperCase());
  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Search Down & Distance"
      className="mobile-search-overlay fixed inset-x-0 bottom-0 top-[var(--site-header-height)] z-[100] flex items-start justify-center overflow-hidden bg-slate-950/75 px-4 py-4 backdrop-blur-sm sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <AiSearchPanel
        variant="overlay"
        teamId={team?.abbr ?? ''}
        teamName={team?.name ?? 'NFL'}
        teamCity={team?.city ?? 'NFL'}
        primaryColor={team?.colors[0] ?? '#00172b'}
        nickname={team?.name.split(/\s+/).at(-1) ?? 'NFL'}
        query={query}
        onQueryChange={setQuery}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}
