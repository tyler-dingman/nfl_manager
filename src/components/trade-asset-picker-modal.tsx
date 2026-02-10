'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';

type PickOption = {
  id: string;
  label: string;
};

type TradeAssetPickerModalProps = {
  isOpen: boolean;
  title: string;
  players: PlayerRowDTO[];
  picks: PickOption[];
  onClose: () => void;
  onSelectPlayer: (player: PlayerRowDTO) => void;
  onSelectPick: (pickId: string) => void;
  duplicateMessage?: string | null;
};

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];

export default function TradeAssetPickerModal({
  isOpen,
  title,
  players,
  picks,
  onClose,
  onSelectPlayer,
  onSelectPick,
  duplicateMessage,
}: TradeAssetPickerModalProps) {
  const [activeTab, setActiveTab] = React.useState<'players' | 'picks'>('players');
  const [search, setSearch] = React.useState('');
  const [position, setPosition] = React.useState('All');
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) {
      setActiveTab('players');
      setSearch('');
      setPosition('All');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filteredPlayers = players.filter((player) => {
    const matchesPosition = position === 'All' || player.position === position;
    const matchesSearch =
      search.trim().length === 0 ||
      `${player.firstName} ${player.lastName}`.toLowerCase().includes(search.toLowerCase());
    return matchesPosition && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} ref={closeRef}>
            ✕
          </Button>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant={activeTab === 'players' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('players')}
          >
            Players
          </Button>
          <Button
            type="button"
            variant={activeTab === 'picks' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('picks')}
          >
            Draft Picks
          </Button>
        </div>

        {duplicateMessage ? (
          <p className="mt-3 text-xs text-destructive">{duplicateMessage}</p>
        ) : null}

        {activeTab === 'players' ? (
          <>
            <div className="mt-4 flex flex-wrap gap-3">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search players..."
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Pos</th>
                    <th className="px-4 py-2">Cap Hit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player) => (
                    <tr
                      key={player.id}
                      className="cursor-pointer border-t border-border hover:bg-slate-50"
                      onClick={() => {
                        onSelectPlayer(player);
                        onClose();
                      }}
                    >
                      <td className="px-4 py-2 font-semibold text-foreground">
                        {player.firstName} {player.lastName}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{player.position}</td>
                      <td className="px-4 py-2 text-muted-foreground">{player.capHit}</td>
                    </tr>
                  ))}
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={3}>
                        No players found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            {picks.map((pick) => (
              <button
                key={pick.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onSelectPick(pick.id);
                  onClose();
                }}
              >
                <span className="font-semibold text-foreground">{pick.label}</span>
                <span className="text-xs text-muted-foreground">Draft Pick</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
