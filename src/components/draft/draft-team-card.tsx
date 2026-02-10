'use client';

import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DraftTeamCardVariant = 'pre' | 'in';

export type DraftTeamCardModel = {
  pickNumber: number;
  teamName: string;
  logoUrl?: string | null;
  needs?: string[];
  record?: string | null;
  note?: string | null;
  statusLine?: string | null;
  isOnClock?: boolean;
  isSelected?: boolean;
};

export const buildDraftTeamCardModel = (model: DraftTeamCardModel) => ({
  ...model,
  teamName: model.teamName || 'Unknown Team',
  logoUrl: model.logoUrl || null,
  needs: model.needs ?? [],
  record: model.record ?? null,
  note: model.note ?? null,
  statusLine: model.statusLine ?? null,
  isOnClock: Boolean(model.isOnClock),
  isSelected: Boolean(model.isSelected),
});

type DraftTeamCardProps = {
  variant: DraftTeamCardVariant;
  model: DraftTeamCardModel;
  onClick?: () => void;
};

export function DraftTeamCard({ variant, model, onClick }: DraftTeamCardProps) {
  const card = buildDraftTeamCardModel(model);
  const sharedClasses =
    'relative w-full rounded-xl border border-border px-3 py-2 text-left transition-all duration-300';
  const stateClasses = cn(
    card.isSelected && 'ring-2 ring-primary/40',
    card.isOnClock && 'border-primary/60',
  );

  return (
    <button
      type="button"
      className={cn(
        sharedClasses,
        variant === 'pre'
          ? 'min-h-[78px] bg-white shadow-sm hover:border-primary/40'
          : 'min-h-[78px] bg-white hover:border-primary/40',
        stateClasses,
      )}
      onClick={onClick}
      aria-pressed={card.isSelected}
    >
      {variant === 'pre' ? <PreDraftTeamCard model={card} /> : <InDraftTeamCard model={card} />}
    </button>
  );
}

type DraftTeamCardInnerProps = {
  model: DraftTeamCardModel;
};

function PreDraftTeamCard({ model }: DraftTeamCardInnerProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-full bg-black/80 px-2 py-1 text-xs font-semibold text-white">
          #{model.pickNumber}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
          {model.logoUrl ? (
            <Image
              src={model.logoUrl}
              alt={`${model.teamName} logo`}
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {model.teamName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{model.teamName}</p>
          {model.needs && model.needs.length > 0 ? (
            <p className="truncate text-xs text-muted-foreground">
              Needs: {model.needs.join(' · ')}
            </p>
          ) : null}
          {model.record || model.note ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {model.record}
              {model.record && model.note ? ' · ' : ''}
              {model.note}
            </p>
          ) : null}
        </div>
      </div>
      {model.isOnClock ? <Badge variant="success">On the clock</Badge> : null}
    </div>
  );
}

function InDraftTeamCard({ model }: DraftTeamCardInnerProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-full bg-black/80 px-2 py-1 text-xs font-semibold text-white">
          #{model.pickNumber}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
          {model.logoUrl ? (
            <Image
              src={model.logoUrl}
              alt={`${model.teamName} logo`}
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          ) : (
            <span className="text-[11px] font-semibold text-muted-foreground">
              {model.teamName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{model.teamName}</p>
          {model.statusLine ? (
            <p className="truncate text-xs text-muted-foreground">{model.statusLine}</p>
          ) : null}
        </div>
      </div>
      {model.isOnClock ? <Badge variant="success">On the clock</Badge> : null}
    </div>
  );
}
