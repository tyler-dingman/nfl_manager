'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import {
  ADS_ENABLED,
  AD_PLACEMENT_ROUTES,
  getCreativeForPlacement,
  type AdPlacement,
} from '@/lib/ads/adConfig';
import { trackAdClick, trackAdImpression } from '@/lib/ads/track';

type AdSlotProps = {
  placement: AdPlacement;
  variant?: 'image' | 'html' | 'house';
  responsive?: { hideOnMobile?: boolean; hideOnDesktop?: boolean };
  onClose?: () => void;
  sticky?: boolean;
};

const ANCHOR_DISMISS_KEY = 'falco_anchor_ad_dismissed';

export function AdSlot({ placement, responsive, onClose, sticky = true }: AdSlotProps) {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (placement !== 'ANCHOR') return;
    const dismissed = sessionStorage.getItem(ANCHOR_DISMISS_KEY);
    setIsDismissed(dismissed === 'true');
  }, [placement]);

  const creative = useMemo(() => {
    if (!pathname) return null;
    return getCreativeForPlacement(placement, pathname);
  }, [pathname, placement]);

  const isAllowedRoute = useMemo(() => {
    if (!pathname) return false;
    const allowed = AD_PLACEMENT_ROUTES[placement] ?? [];
    return allowed.some((route) => pathname.startsWith(route));
  }, [pathname, placement]);

  useEffect(() => {
    if (!ADS_ENABLED || !creative || !pathname || !isAllowedRoute) return;
    trackAdImpression(placement, creative.id, pathname);
  }, [creative, isAllowedRoute, pathname, placement]);

  if (!ADS_ENABLED || !creative || !pathname || !isAllowedRoute) {
    return null;
  }

  if (placement === 'ANCHOR' && isDismissed) {
    return null;
  }

  const responsiveClasses = cn(
    responsive?.hideOnMobile ? 'hidden md:block' : null,
    responsive?.hideOnDesktop ? 'md:hidden' : null,
  );

  const handleClose = () => {
    if (placement === 'ANCHOR') {
      sessionStorage.setItem(ANCHOR_DISMISS_KEY, 'true');
      setIsDismissed(true);
    }
    onClose?.();
  };

  const containerClass =
    placement === 'ANCHOR'
      ? cn(
          'fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-full px-3 pb-[env(safe-area-inset-bottom)]',
          responsiveClasses,
        )
      : cn('w-full max-w-full', placement === 'HEADER' ? 'max-w-[240px]' : null, responsiveClasses);

  const shouldStick = placement === 'RIGHT_RAIL' && sticky;

  return (
    <div className={containerClass}>
      <div
        className={cn(
          'relative w-full max-w-full overflow-hidden rounded-xl border border-border bg-white shadow-sm',
          shouldStick ? 'sticky top-24' : null,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          <span>Ad</span>
          {placement === 'ANCHOR' ? (
            <button
              type="button"
              onClick={handleClose}
              className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground"
              aria-label="Close ad"
            >
              Close
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => trackAdClick(placement, creative.id, pathname)}
          className="flex w-full items-center justify-center px-3 py-3"
          aria-label="Ad"
        >
          <Image
            src={creative.src}
            alt={creative.alt}
            width={600}
            height={240}
            className="h-auto w-full max-w-full object-contain"
          />
        </button>
      </div>
    </div>
  );
}
