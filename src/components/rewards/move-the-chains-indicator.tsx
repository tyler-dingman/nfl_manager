'use client';

import Link from 'next/link';
import { Goal, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Dashboard = {
  progress: { lifetimeYards: number; touchdowns: number; currentDriveYards: number };
  yardsToNextReward: number;
  nextReward: { title?: string } | null;
};

export default function MoveTheChainsIndicator() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/rewards')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active) setData(body?.rewards ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  if (!data) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-full border border-[#00172B]/15 px-4 text-xs font-black leading-none"
        aria-expanded={open}
      >
        <Goal className="h-4 w-4" /> {data.progress.lifetimeYards.toLocaleString()} YDS
      </button>
      {open ? (
        <div className="absolute right-0 top-14 z-50 w-72 rounded-3xl bg-[#00172B] p-5 text-white shadow-2xl">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 text-white/55"
            aria-label="Close rewards"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F4D9B7]">
            Move the Chains
          </p>
          <p className="mt-3 text-3xl font-black">
            {data.progress.lifetimeYards.toLocaleString()} yards
          </p>
          <p className="mt-1 text-sm text-white/65">
            {data.progress.touchdowns} touchdowns · {data.progress.currentDriveYards}/100 current
            drive
          </p>
          <p className="mt-4 border-t border-white/10 pt-4 text-xs font-bold text-white/70">
            {data.nextReward
              ? `${data.yardsToNextReward} yards to ${data.nextReward.title}`
              : 'You reached the top of the ladder.'}
          </p>
          <Link
            href="/rewards"
            className="mt-4 inline-flex rounded-full bg-[#FF3D38] px-4 py-2 text-xs font-black"
          >
            Open The Locker
          </Link>
        </div>
      ) : null}
    </div>
  );
}
