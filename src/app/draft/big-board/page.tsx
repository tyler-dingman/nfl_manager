'use client';

import * as React from 'react';

import AppShell from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';
import {
  buildFalcoBoard,
  falcoProfile,
  falcoToneStyles,
  formatFalcoDelta,
  type FalcoNote,
} from '@/lib/falco';
import { buildTop32Prospects } from '@/server/data/prospects-top32';
import { cn } from '@/lib/utils';

const formatName = (firstName: string, lastName: string) => `${firstName} ${lastName}`.trim();

export default function DraftBigBoardPage() {
  const saveId = useSaveStore((state) => state.saveId);
  const [falcoNonce, setFalcoNonce] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'takes' | 'wire'>('takes');
  const prospects = React.useMemo(() => buildTop32Prospects(), []);
  const falcoSeed = `${saveId ?? 'global'}-${falcoNonce}`;
  const falcoBoard = React.useMemo(
    () => buildFalcoBoard(prospects, falcoSeed),
    [prospects, falcoSeed],
  );

  const notesByPlayer = React.useMemo(() => {
    const map = new Map<string, FalcoNote[]>();
    falcoBoard.notes.forEach((note) => {
      const list = map.get(note.playerId) ?? [];
      list.push(note);
      map.set(note.playerId, list);
    });
    return map;
  }, [falcoBoard.notes]);

  const topTen = prospects.slice(0, 10);
  const rest = prospects.slice(10);
  const tweets = falcoBoard.tweets;
  const tickerItems = tweets.slice(0, 6);
  const [tickerIndex, setTickerIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setTickerIndex((index) => (index + 1) % Math.max(1, tickerItems.length));
    }, 3000);
    return () => window.clearInterval(interval);
  }, [tickerItems.length]);

  const renderRow = (prospect: (typeof prospects)[number]) => {
    const notes = notesByPlayer.get(prospect.id) ?? [];
    const delta = notes[0]?.delta ?? 0;
    const tags = notes.slice(0, 2).map((note) => note.tag);
    return (
      <div
        key={prospect.id}
        className="flex items-center gap-3 rounded-xl border border-border bg-white/90 px-4 py-3 shadow-sm"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {prospect.headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prospect.headshotUrl}
              alt={formatName(prospect.firstName, prospect.lastName)}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            `${prospect.firstName.charAt(0)}${prospect.lastName.charAt(0)}`
          )}
        </div>
        <div className="flex w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {prospect.rank ?? '-'}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {formatName(prospect.firstName, prospect.lastName)}
          </p>
          <p className="text-xs text-muted-foreground">{prospect.position}</p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">{formatFalcoDelta(delta)}</div>
        <div className="hidden flex-wrap gap-1 sm:flex">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Falco’s Big Board</h1>
          <p className="text-sm text-muted-foreground">{falcoProfile.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Powered by Falco</Badge>
          <Button type="button" variant="outline" onClick={() => setFalcoNonce((n) => n + 1)}>
            Refresh takes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Top 10</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-white/70">Falco Board</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {topTen.slice(0, 5).map(renderRow)}
              {topTen.slice(5).map(renderRow)}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">11–32</h2>
              <span className="text-xs text-muted-foreground">Falco’s extended board</span>
            </div>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
              {rest.map(renderRow)}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={activeTab === 'takes' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('takes')}
              >
                Falco Takes
              </Button>
              <Button
                type="button"
                variant={activeTab === 'wire' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('wire')}
              >
                Falco Wire
              </Button>
            </div>

            {activeTab === 'takes' ? (
              <div className="mt-4 space-y-3">
                {falcoBoard.notes.map((note) => (
                  <div
                    key={`${note.playerId}-${note.createdAt}`}
                    className="rounded-xl border border-border px-3 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">
                        {note.tag}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(note.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{note.blurb}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Delta {formatFalcoDelta(note.delta)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {tweets.map((tweet) => (
                  <div key={tweet.id} className="rounded-xl border border-border px-3 py-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-[10px] font-semibold uppercase',
                          falcoToneStyles(tweet.tone),
                        )}
                      >
                        {tweet.tone}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(tweet.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{tweet.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">— Falco (@FalcoDraft)</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
              {tickerItems.length > 0 ? (
                <span>{tickerItems[tickerIndex]?.body}</span>
              ) : (
                <span>Falco wire warming up…</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
