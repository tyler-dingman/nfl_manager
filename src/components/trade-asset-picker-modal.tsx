'use client';

import * as React from 'react';

import PlayerHeadshot from '@/components/player-headshot';
import PlayerTypeIcon from '@/components/player-type-icon';
import { Button } from '@/components/ui/button';
import type { PlayerRowDTO } from '@/types/player';

const NFL_DRAFT_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/en/thumb/8/80/NFL_Draft_logo.svg/500px-NFL_Draft_logo.svg.png';

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

const POSITIONS = [
  'All',
  'QB',
  'RB',
  'WR',
  'TE',
  'OT',
  'IOL',
  'EDGE',
  'DL',
  'LB',
  'CB',
  'S',
  'K',
  'P',
];

const normalizeTradePosition = (position: string) => {
  const normalized = position.trim().toUpperCase();
  if (['LT', 'RT', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'C', 'G', 'OL', 'IOL'].includes(normalized)) return 'IOL';
  if (['DE', 'EDGE', 'ED', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['DT', 'NT', 'DL'].includes(normalized)) return 'DL';
  if (['MLB', 'ILB', 'OLB', 'LOLB', 'ROLB', 'LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  return normalized;
};

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

  const filteredPlayers = [...players]
    .filter((player) => {
      const matchesPosition =
        position === 'All' || normalizeTradePosition(player.position) === position;
      const matchesSearch =
        search.trim().length === 0 ||
        `${player.firstName} ${player.lastName}`.toLowerCase().includes(search.toLowerCase());
      return matchesPosition && matchesSearch;
    })
    .sort((left, right) => {
      const ratingDelta = (right.rating ?? -1) - (left.rating ?? -1);
      if (ratingDelta !== 0) {
        return ratingDelta;
      }
      const leftName = `${left.firstName} ${left.lastName}`;
      const rightName = `${right.firstName} ${right.lastName}`;
      return leftName.localeCompare(rightName);
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
                    <th className="px-4 py-2">OVR</th>
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
                        <div className="flex items-center gap-2">
                          <div className="relative shrink-0">
                            <PlayerTypeIcon
                              player={player}
                              className="absolute -left-4 top-1/2 -translate-y-1/2"
                            />
                            <PlayerHeadshot player={player} size={24} />
                          </div>
                          <span className="truncate">
                            {player.firstName} {player.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{player.position}</td>
                      <td className="px-4 py-2 text-muted-foreground">{player.rating ?? '--'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{player.capHit}</td>
                    </tr>
                  ))}
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={4}>
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
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={NFL_DRAFT_LOGO_URL}
                    alt="NFL Draft"
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <span className="font-semibold text-foreground">{pick.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">Draft Pick</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
