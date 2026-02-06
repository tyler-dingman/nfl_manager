'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TradeSlotAsset = {
  id: string;
  type: 'player' | 'pick';
  label: string;
  sublabel?: string;
  meta?: string;
  headshotUrl?: string | null;
};

type TradeAssetSlotsProps = {
  title: string;
  subtitle: string;
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
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {title}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{subtitle}</h2>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {slots.map((slot, index) => (
          <button
            key={`slot-${index}`}
            type="button"
            onClick={() => (slot ? onReplace(index) : onAdd(index))}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50',
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
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {slot.type === 'pick' ? 'P' : slot.label.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{slot.label}</p>
                  {slot.sublabel ? (
                    <p className="text-xs text-muted-foreground">{slot.sublabel}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">+ Add asset</span>
            )}
            {slot ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(index);
                }}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove asset</span>
              </Button>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
