import Image from 'next/image';
import { SPORTSBOOKS } from '@/server/odds/sportsbooks';

export function BeatBannerAd() {
  const destination = SPORTSBOOKS.find((book) => book.id === 'DRAFTKINGS')?.url;
  const banner = (
    <Image
      src="/images/ads/draftkings_the_beat_banner.png"
      alt="DraftKings advertisement"
      width={1002}
      height={256}
      unoptimized
      className="block h-auto w-full rounded-2xl object-cover"
    />
  );

  return (
    <aside aria-label="Advertisement" className="col-span-full min-w-0 self-start">
      {destination ? (
        <a
          href={destination}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {banner}
        </a>
      ) : (
        banner
      )}
    </aside>
  );
}
