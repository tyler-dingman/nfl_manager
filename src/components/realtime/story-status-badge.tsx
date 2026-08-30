import type { RealtimeStoryStatus } from '@/features/realtime/types';

const styles: Record<RealtimeStoryStatus, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  REPORTED: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  DEVELOPING: 'bg-amber-100 text-amber-900 ring-amber-600/20',
  RUMOR: 'bg-slate-200 text-slate-700 ring-slate-500/20',
};

export default function StoryStatusBadge({ status }: { status: RealtimeStoryStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black tracking-[0.16em] ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}
