'use client';

import Image from 'next/image';

type OnTheClockBannerProps = {
  teamName: string;
  teamLogoUrl?: string | null;
  isVisible: boolean;
};

export function OnTheClockBanner({ teamName, teamLogoUrl, isVisible }: OnTheClockBannerProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="mb-6 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-[#0A2A66] via-[#1453B8] to-[#0A2A66] px-6 py-5 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        {teamLogoUrl ? (
          <Image src={teamLogoUrl} alt={`${teamName} logo`} width={64} height={64} />
        ) : (
          <span className="text-sm font-semibold text-white">{teamName}</span>
        )}
      </div>
      <div className="flex-1">
        <p
          className="text-4xl font-extrabold uppercase text-[#FF2D55] md:text-5xl"
          style={{ textShadow: '0 2px 12px rgba(255, 45, 85, 0.45)' }}
        >
          On the clock
        </p>
      </div>
    </div>
  );
}
