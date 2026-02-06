type TeamHeaderSummaryProps = {
  capSpace: number;
  capLimit: number;
  rosterCount: number;
  rosterLimit: number;
};

function formatCap(value: number) {
  return `$${value.toFixed(1)}M`;
}

export default function TeamHeaderSummary({
  capSpace,
  capLimit,
  rosterCount,
  rosterLimit,
}: TeamHeaderSummaryProps) {
  const capPercent = capLimit ? Math.min((capSpace / capLimit) * 100, 100) : 0;
  const rosterPercent = rosterLimit ? Math.min((rosterCount / rosterLimit) * 100, 100) : 0;

  return (
    <section
      className="mb-6 rounded-2xl border border-transparent bg-white/80 px-6 py-5 shadow-sm"
      style={{
        backgroundColor: 'var(--team-primary)',
        borderColor: 'var(--team-secondary)',
        color: 'var(--team-primary-foreground)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{
              color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
            }}
          >
            Team Summary
          </p>
          <h2 className="mt-2 text-xl font-semibold">Cap and roster overview</h2>
          <p
            className="mt-1 text-sm"
            style={{
              color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
            }}
          >
            Keep tabs on remaining flexibility and roster spots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-[150px]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{formatCap(capSpace)}</span>
              <span
                style={{
                  color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
                }}
              >
                {formatCap(capLimit)} limit
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/40">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${capPercent}%`,
                  backgroundColor: 'var(--team-primary-foreground)',
                }}
              />
            </div>
            <p
              className="mt-2 text-xs uppercase tracking-[0.2em]"
              style={{
                color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
              }}
            >
              Cap Space
            </p>
          </div>
          <div className="min-w-[150px]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                {rosterCount}/{rosterLimit}
              </span>
              <span
                style={{
                  color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
                }}
              >
                {rosterLimit - rosterCount} open
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/40">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${rosterPercent}%`,
                  backgroundColor: 'var(--team-primary-foreground)',
                }}
              />
            </div>
            <p
              className="mt-2 text-xs uppercase tracking-[0.2em]"
              style={{
                color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
              }}
            >
              Roster Count
            </p>
          </div>
          <div className="min-w-[120px]">
            <p
              className="text-xs uppercase tracking-[0.2em]"
              style={{
                color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
              }}
            >
              Cap trend
            </p>
            <div className="mt-3 h-12 w-28 rounded-lg border border-dashed border-white/50 bg-white/20 p-2">
              <svg viewBox="0 0 120 40" className="h-full w-full">
                <path
                  d="M0 28 L20 18 L40 24 L60 10 L80 16 L100 8 L120 12"
                  fill="none"
                  stroke="var(--team-primary-foreground)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
