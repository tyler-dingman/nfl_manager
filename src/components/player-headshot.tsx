'use client';

import Image from 'next/image';

import type { PlayerRowDTO } from '@/types/player';

type PlayerHeadshotProps = {
  player: Pick<PlayerRowDTO, 'firstName' | 'lastName' | 'headshotUrl'>;
  size?: number;
};

const initialsFor = (player: Pick<PlayerRowDTO, 'firstName' | 'lastName'>) =>
  `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase();

export default function PlayerHeadshot({ player, size = 28 }: PlayerHeadshotProps) {
  if (player.headshotUrl) {
    return (
      <Image
        src={player.headshotUrl}
        alt={`${player.firstName} ${player.lastName}`.trim()}
        width={size}
        height={size}
        className="rounded-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initialsFor(player)}
    </div>
  );
}
