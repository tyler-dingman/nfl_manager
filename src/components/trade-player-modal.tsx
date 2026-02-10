'use client';

import type { PlayerRowDTO } from '@/types/player';

import { PlayerTable } from './player-table';
import { Button } from './ui/button';

export type TradePlayerModalProps = {
  isOpen: boolean;
  sideLabel: string;
  players: PlayerRowDTO[];
  onClose: () => void;
  onSelectPlayer: (player: PlayerRowDTO) => void;
};

export default function TradePlayerModal({
  isOpen,
  sideLabel,
  players,
  onClose,
  onSelectPlayer,
}: TradePlayerModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-lg sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Add Player
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              Select a player for {sideLabel}
            </h3>
            <p className="text-sm text-muted-foreground">Filter by position or search by name.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="mt-6">
          <PlayerTable
            data={players}
            variant="tradePicker"
            onSelectTradePlayer={(player) => {
              onSelectPlayer(player);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
