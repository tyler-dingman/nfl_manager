'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import PlayerTypeIcon from '@/components/player-type-icon';
import type { PlayerTypeIndicatorResult } from '@/lib/player-type-indicator';
import { cn } from '@/lib/utils';

const NFL_DRAFT_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/en/thumb/8/80/NFL_Draft_logo.svg/500px-NFL_Draft_logo.svg.png';

export type TradeSlotAsset = {
  id: string;
  type: 'player' | 'pick';
  label: string;
  sublabel?: string;
  meta?: string;
  headshotUrl?: string | null;
  playerTypeIndicator?: PlayerTypeIndicatorResult | null;
};

type TradeAssetSlotsProps = {
  title?: string;
  subtitle?: string;
  slots: Array<TradeSlotAsset | null>;
  onAdd: (slotIndex: number) => void;
  onRemove: (slotIndex: number) => void;
  onReplace: (slotIndex: number) => void;
};

export default function TradeAssetSlots({
  title,
  subtitle,
  slots,
  onAdd,
  onRemove,
  onReplace,
}: TradeAssetSlotsProps) {
  const hasHeader = Boolean(title || subtitle);

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      {hasHeader ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {title}
              </p>
            ) : null}
            {subtitle ? (
              <h2 className="mt-1 text-lg font-semibold text-foreground">{subtitle}</h2>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={cn('space-y-3', hasHeader && 'mt-4')}>
        {slots.map((slot, index) => (
          <div
            key={`slot-${index}`}
            role="button"
            tabIndex={0}
            onClick={() => (slot ? onReplace(index) : onAdd(index))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                slot ? onReplace(index) : onAdd(index);
              }
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50',
              'cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
              slot && 'border-solid',
            )}
          >
            {slot ? (
              <div className="flex items-center gap-3">
                {slot.headshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.headshotUrl}
                    alt={slot.label}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : slot.type === 'pick' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={NFL_DRAFT_LOGO_URL}
                    alt="NFL Draft"
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {slot.label.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">{slot.label}</p>
                    <PlayerTypeIcon indicator={slot.playerTypeIndicator} />
                  </div>
                  {slot.sublabel ? (
                    <p className="text-xs text-muted-foreground">{slot.sublabel}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">+ Add asset</span>
            )}
            {slot ? (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove(index);
                }}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove asset</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
