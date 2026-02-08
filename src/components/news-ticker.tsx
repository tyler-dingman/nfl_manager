'use client';

import * as React from 'react';

import type { NewsItemDTO } from '@/types/news';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

type NewsTickerProps = {
  saveId?: string | null;
};

const fetchNews = async (saveId: string): Promise<NewsItemDTO[]> => {
  const response = await apiFetch(`/api/news?saveId=${saveId}`);
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { ok: boolean; items: NewsItemDTO[] };
  if (!payload.ok) {
    return [];
  }
  return payload.items;
};

export default function NewsTicker({ saveId }: NewsTickerProps) {
  const [items, setItems] = React.useState<NewsItemDTO[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isFeedOpen, setIsFeedOpen] = React.useState(false);

  React.useEffect(() => {
    if (!saveId) {
      setItems([]);
      return;
    }
    let isActive = true;

    const load = async () => {
      const data = await fetchNews(saveId);
      if (isActive) {
        setItems(data);
      }
    };

    load();
    const interval = window.setInterval(load, 6000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [saveId]);

  React.useEffect(() => {
    if (isPaused || items.length === 0) {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % Math.min(items.length, 5));
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isPaused, items.length]);

  const visibleItems = items.slice(0, 5);
  const activeItem = visibleItems[activeIndex] ?? visibleItems[0];

  return (
    <div
      className="mb-6 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => {
        if (!isFeedOpen) {
          setIsFeedOpen(true);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            News
          </span>
          <div className="hidden text-sm font-medium text-foreground md:block">
            {activeItem ? activeItem.details : 'No updates yet.'}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsFeedOpen(true)}>
          View all
        </Button>
      </div>

      <div className="mt-2 flex gap-3 overflow-x-auto text-sm text-muted-foreground md:hidden">
        {visibleItems.length === 0 ? (
          <span>No updates yet.</span>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="min-w-[220px] rounded-lg bg-slate-50 px-3 py-2">
              {item.details}
            </div>
          ))
        )}
      </div>

      {isFeedOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onClick={() => setIsFeedOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">News Feed</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsFeedOpen(false)}
              >
                ✕
              </Button>
            </div>
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No news yet.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{item.details}</p>
                    {item.quote ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        &ldquo;{item.quote}&rdquo;
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
