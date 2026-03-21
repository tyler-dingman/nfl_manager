'use client';

import type { TeamDTO } from '@/types/team';
import type { PlayerRowDTO } from '@/types/player';

type PickAnnouncementProps = {
  open: boolean;
  team: TeamDTO | null;
  player: PlayerRowDTO | null;
  grade?: string | null;
};

export function PickAnnouncement({ open, team, player, grade }: PickAnnouncementProps) {
  if (!open || !player) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-40 flex justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950/95 px-5 py-4 text-white shadow-2xl backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
          The Pick Is In
        </p>
        <p className="mt-2 text-lg font-semibold sm:text-xl">
          {team?.name ?? 'Your team'} select {player.firstName} {player.lastName}
        </p>
        <p className="mt-1 text-sm text-slate-300">
          {player.position} · {player.college ?? 'School TBD'}
        </p>
        {grade ? (
          <div className="mt-3 inline-flex rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
            Grade {grade}
          </div>
        ) : null}
      </div>
    </div>
  );
}
