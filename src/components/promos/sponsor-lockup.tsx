import Image from 'next/image';

export default function SponsorLockup({
  sponsor,
  logoPath,
}: {
  sponsor: string;
  logoPath?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] opacity-70">
      <span>Presented by</span>
      {logoPath ? (
        <span className="flex min-h-10 min-w-32 items-center rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
          <Image
            src={logoPath}
            alt={`${sponsor} logo`}
            width={150}
            height={48}
            className="h-8 max-w-36 object-contain object-left"
          />
        </span>
      ) : (
        <strong className="rounded border border-current px-2.5 py-1 text-sm tracking-normal">
          {sponsor}
        </strong>
      )}
    </div>
  );
}
