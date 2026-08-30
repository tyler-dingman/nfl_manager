import { Clock3 } from 'lucide-react';

export default function StoryFreshness({
  updatedAt,
  lastCheckedAt,
}: {
  updatedAt: string;
  lastCheckedAt: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
      <Clock3 className="h-3.5 w-3.5" /> Updated{' '}
      {new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Last
      checked{' '}
      {new Date(lastCheckedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })}
    </span>
  );
}
