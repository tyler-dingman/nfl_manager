import Image from 'next/image';

import { cn } from '@/lib/utils';

type BigBoardCardProps = {
  rank: number | string;
  position: string;
  name: string;
  college: string;
  logoUrl?: string | null;
  positionAbbr?: string;
  className?: string;
};

export default function BigBoardCard({
  rank,
  position,
  name,
  college,
  logoUrl,
  positionAbbr,
  className,
}: BigBoardCardProps) {
  const initials = college
    .replace(/\([^)]*\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-[#0b1220] p-4 shadow-[0_16px_35px_rgba(3,7,18,0.25)] transition hover:border-white/20 hover:bg-[#0f172a] md:p-5',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 text-right text-4xl font-extrabold tracking-tight text-white md:w-16 md:text-5xl">
          {rank}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-red-500 md:text-sm">
            {positionAbbr || position || '—'}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold uppercase tracking-wide text-white md:text-2xl">
              {name}
            </div>
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-[10px] font-semibold uppercase text-slate-200 md:h-8 md:w-8">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={college}
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span>{initials || '—'}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
