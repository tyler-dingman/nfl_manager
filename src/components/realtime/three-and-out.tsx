import { ArrowDownRight } from 'lucide-react';

export default function ThreeAndOut({
  whatHappened,
  whyItMatters,
  whatsNext,
}: {
  whatHappened: string;
  whyItMatters: string;
  whatsNext: string;
}) {
  const items = [
    ['What happened', whatHappened],
    ['Why it matters', whyItMatters],
    ['What’s next', whatsNext],
  ];
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--team-primary-text)]">
        Three and Out
      </p>
      <div className="mt-4 grid gap-3">
        {items.map(([label, text], index) => (
          <div key={label} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl bg-slate-50 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--dark)] text-sm font-black text-[var(--team-on-dark)]">
              {index + 1}
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {label}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-400">
        <ArrowDownRight className="h-3.5 w-3.5" /> Only verified details are included.
      </p>
    </section>
  );
}
