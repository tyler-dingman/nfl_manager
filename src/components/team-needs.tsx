import type { TeamNeed } from '@/lib/team-overview';

type TeamNeedsProps = {
  teamNeeds: TeamNeed[];
};

export function TeamNeeds({ teamNeeds }: TeamNeedsProps) {
  if (!teamNeeds || teamNeeds.length === 0) return null;

  const topNeeds = teamNeeds.slice(0, 3).join(' • ');

  return (
    <div className="shrink-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Needs
      </span>
      <span className="block text-sm font-semibold text-foreground whitespace-nowrap">
        {topNeeds}
      </span>
    </div>
  );
}
