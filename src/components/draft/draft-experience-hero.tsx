'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from '@/app/draft/room/mock-draft-room.module.css';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { FRONT_OFFICE_NAVIGATION } from '@/lib/front-office-navigation';

export type DraftExperienceNavKey = (typeof FRONT_OFFICE_NAVIGATION.draft)[number]['key'];

export function DraftExperienceHero({
  title,
  description,
  active,
  actions,
  compact = false,
  draftStatus,
}: {
  title: string;
  description: string;
  active?: DraftExperienceNavKey;
  actions?: ReactNode;
  compact?: boolean;
  draftStatus?: { paused: boolean; round: number; pick: number; team: string; clock: string };
}) {
  void active;
  const heroControls = useRef<HTMLDivElement>(null);
  const [showStrip, setShowStrip] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(0);
  const [documentZoom, setDocumentZoom] = useState(1);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (showStrip) {
      setExiting(true);
      return;
    }
    const timer = setTimeout(() => setExiting(false), 160);
    return () => clearTimeout(timer);
  }, [showStrip]);
  const enabled = compact && !!draftStatus;
  useEffect(() => {
    const controls = heroControls.current;
    if (!enabled || !controls) {
      setShowStrip(false);
      return;
    }
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    let observer: IntersectionObserver;
    const observe = () => {
      const offset = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      // DOM rectangles use viewport pixels; fixed CSS offsets inherit the desktop document zoom.
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      setDocumentZoom(zoom);
      setHeaderOffset(offset / zoom);
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          // Only activate after passing the controls, not when they are below the viewport.
          setShowStrip(!entry.isIntersecting && entry.boundingClientRect.bottom <= offset);
        },
        { rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(controls);
    };
    const resize = new ResizeObserver(observe);
    if (header) resize.observe(header);
    observe();
    window.addEventListener('resize', observe);
    return () => {
      observer?.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', observe);
    };
  }, [enabled]);
  useEffect(() => {
    if (heroControls.current) heroControls.current.inert = enabled && showStrip;
  }, [enabled, showStrip]);
  return (
    <>
      <FrontOfficeStrategicHero
        compact={compact}
        section={title}
        title={title}
        description={description}
        actions={
          <div ref={heroControls} className={styles.heroDraftControls}>
            {actions}
          </div>
        }
      />
      {enabled && (showStrip || exiting) && (
        <div
          className={styles.stickyDraftControls}
          style={
            {
              '--draft-header-offset': `${headerOffset}px`,
              '--draft-document-zoom': documentZoom,
            } as CSSProperties
          }
          data-visible={showStrip}
          aria-hidden={!showStrip}
          ref={(element) => {
            if (element) element.inert = !showStrip;
          }}
          role="region"
          aria-label="Sticky draft controls"
        >
          <div className={styles.draftControlStripInner}>
            <div className={styles.compactDraftStatus}>
              <strong>{draftStatus.paused ? 'Ⅱ PAUSED' : '● LIVE'}</strong>
              <span>
                R{draftStatus.round} · Pick {draftStatus.pick}
              </span>
              <small>
                {draftStatus.team} on the clock · <time>{draftStatus.clock}</time>
              </small>
            </div>
            <div className={styles.compactDraftActions}>{actions}</div>
          </div>
        </div>
      )}
      <FrontOfficeSectionNav section="draft" />
    </>
  );
}
