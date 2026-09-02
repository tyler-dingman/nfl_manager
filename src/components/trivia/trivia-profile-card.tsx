'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
export default function TriviaProfileCard() {
  const [data, setData] = useState<{
    stats: { lifetimePoints: number; accuracy: number; gamesPlayed: number };
    moveTheChains: { currentDriveYards: number; touchdowns: number };
  } | null>(null);
  useEffect(() => {
    void fetch('/api/trivia/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, []);
  if (!data) return null;
  return (
    <section className="rounded-3xl bg-[#00172B] p-6 text-white">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#F4D9B7]">Trivia</p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Trivia points" value={data.stats.lifetimePoints.toLocaleString()} />
        <Stat label="Accuracy" value={`${data.stats.accuracy}%`} />
        <Stat label="Games played" value={String(data.stats.gamesPlayed)} />
        <Stat label="Move the Chains" value={`${data.moveTheChains.currentDriveYards}/100`} />
      </div>
      <p className="mt-4 text-xs font-bold text-white/55">
        {data.moveTheChains.touchdowns} touchdowns
      </p>
      <Link href="/trivia" className="mt-5 inline-flex text-sm font-black text-[#F4D9B7]">
        Play Trivia →
      </Link>
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/45">{label}</p>
    </div>
  );
}
