'use client';

import FalcoAvatar from '@/components/falco/falco-avatar';
import type { FalcoAlertItem } from '@/features/draft/falco-alert-store';

type FalcoTickerProps = {
  alerts: FalcoAlertItem[];
};

const formatTime = (value: string) => {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export default function FalcoTicker({ alerts }: FalcoTickerProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <FalcoAvatar size={24} />
        <div>
          <p className="text-sm font-semibold text-foreground">Falco Alerts</p>
          <p className="text-xs text-muted-foreground">Draft desk ticker</p>
        </div>
      </div>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-border bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{alert.title ?? alert.type.replace('_', ' ')}</span>
                <span>{formatTime(alert.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {alert.lines && alert.lines.length > 0 ? alert.lines[0] : alert.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
