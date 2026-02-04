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
  const rosterPercent = rosterLimit
    ? Math.min((rosterCount / rosterLimit) * 100, 100)
    : 0;

  return (
    <section
      className="mb-6 rounded-2xl border border-transparent bg-white/80 px-6 py-5 shadow-sm"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--team-primary) 6%, white)',
        borderColor: 'color-mix(in srgb, var(--team-primary) 18%, transparent)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Team Summary
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Cap and roster overview
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep tabs on remaining flexibility and roster spots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-[150px]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                {formatCap(capSpace)}
              </span>
              <span className="text-muted-foreground">
                {formatCap(capLimit)} limit
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${capPercent}%`,
                  backgroundColor: 'var(--team-primary)',
                }}
              />
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Cap Space
            </p>
          </div>
          <div className="min-w-[150px]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                {rosterCount}/{rosterLimit}
              </span>
              <span className="text-muted-foreground">
                {rosterLimit - rosterCount} open
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${rosterPercent}%`,
                  backgroundColor: 'var(--team-secondary)',
                }}
              />
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Roster Count
            </p>
          </div>
          <div className="min-w-[120px]">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Cap trend
            </p>
            <div className="mt-3 h-12 w-28 rounded-lg border border-dashed border-muted-foreground/40 bg-white/70 p-2">
              <svg viewBox="0 0 120 40" className="h-full w-full">
                <path
                  d="M0 28 L20 18 L40 24 L60 10 L80 16 L100 8 L120 12"
                  fill="none"
                  stroke="var(--team-primary)"
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
