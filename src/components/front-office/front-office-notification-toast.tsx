'use client';
import type { ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
export function FrontOfficeNotificationToast({
  logo,
  meta,
  children,
  onView,
  onDismiss,
  priority = 'normal',
  actionLabel,
  variant,
}: {
  logo: ReactNode;
  meta: ReactNode;
  children: ReactNode;
  onView: () => void;
  onDismiss: () => void;
  priority?: string;
  actionLabel?: string;
  variant?: 'draft-trade';
}) {
  return (
    <aside
      className={`fo-event-toast priority-${priority}`}
      data-variant={variant}
      role={priority === 'urgent' ? 'alert' : 'status'}
    >
      <button className="fo-event-toast-main" type="button" onClick={onView}>
        {logo}
        <span className="fo-event-toast-copy">
          <span className="fo-news-meta">{meta}</span>
          <strong>{children}</strong>
          {actionLabel && <span>{actionLabel}</span>}
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
      <button
        className="fo-event-close"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X />
      </button>
    </aside>
  );
}
