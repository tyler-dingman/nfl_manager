import AppShell from '@/components/app-shell';
import BigBoardCard from '@/components/big-board-card';
import FalcoAvatar from '@/components/falco/falco-avatar';
import { buildFalcoBoard, falcoToneStyles } from '@/lib/falco';
import { toTwoLetterPosition } from '@/lib/position-utils';
import { getCollegeLogoUrl } from '@/server/collegeLogos';
import { buildTop32Prospects } from '@/server/data/prospects-top32';

export default async function DraftBigBoardPage() {
  const prospects = buildTop32Prospects();
  const collegeSet = new Set(
    prospects
      .map((player) => player.college)
      .filter((college): college is string => Boolean(college)),
  );
  const collegeEntries = await Promise.all(
    Array.from(collegeSet).map(
      async (college) => [college, await getCollegeLogoUrl(college)] as const,
    ),
  );
  const collegeLogoMap = new Map(collegeEntries);
  const { tweets } = buildFalcoBoard(prospects, 'falco-big-board');
  const falcoTweets = tweets.slice(0, 8);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <FalcoAvatar size={28} />
          <h1 className="text-2xl font-semibold text-foreground">Falco’s Big Board</h1>
        </div>
        <p className="text-sm text-muted-foreground">Built from tape, traits, and truth.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/5 bg-gradient-to-br from-[#0b1220] via-[#0b1220] to-[#111827] p-4 shadow-[0_20px_50px_rgba(3,7,18,0.35)] md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
              Falco Rankings
            </div>
            <div className="text-xs font-medium text-white/40">{prospects.length} Prospects</div>
          </div>
          <div className="space-y-3">
            {prospects.map((player, index) => {
              const name = `${player.firstName} ${player.lastName}`.trim() || 'Unknown';
              const college = player.college ?? '—';
              return (
                <BigBoardCard
                  key={player.id}
                  rank={player.rank ?? index + 1}
                  position={player.position ?? '—'}
                  positionAbbr={toTwoLetterPosition(player.position ?? '')}
                  name={name}
                  college={college}
                  logoUrl={collegeLogoMap.get(college)}
                />
              );
            })}
          </div>
        </section>
        <section className="rounded-3xl border border-border bg-card/60 p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FalcoAvatar size={28} />
              <div>
                <div className="text-base font-semibold text-foreground">Falco’s Takes</div>
                <div className="text-xs text-muted-foreground">Live desk chatter</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Just now</div>
          </div>
          <div className="space-y-3">
            {falcoTweets.map((tweet) => (
              <div
                key={tweet.id}
                className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <FalcoAvatar size={20} className="h-5 w-5" />
                  <div className="text-xs font-semibold text-muted-foreground">Falco Draft</div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${falcoToneStyles(
                      tweet.tone,
                    )}`}
                  >
                    {tweet.tone}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">{tweet.body}</p>
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Moments ago
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
