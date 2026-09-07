'use client';

import Link from 'next/link';

import { useSaveStore } from '@/features/save/save-store';
import { formatMoneyMillions } from '@/server/logic/cap';

type SupportingPanelMode = 'roster' | 'trade' | 'free-agency' | 'draft';
type Panel = {
  title: string;
  href?: string;
  items: Array<{ label: string; value: string }>;
  empty?: string;
};

function SectionCard({ panel }: { panel: Panel }) {
  return (
    <section className="fo-section-card">
      <div className="fo-section-card-heading">
        <h2>{panel.title}</h2>
        {panel.href ? <Link href={panel.href}>View</Link> : null}
      </div>
      {panel.items.length ? (
        <dl>
          {panel.items.map((item) => (
            <div key={`${panel.title}-${item.label}`}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="fo-section-empty">{panel.empty ?? 'Nothing to report yet.'}</p>
      )}
    </section>
  );
}

export function FrontOfficeSupportingPanels({ mode }: { mode: SupportingPanelMode }) {
  const roster = useSaveStore((state) => state.roster);
  const capSpace = useSaveStore((state) => state.capSpace);
  const activeRoster = roster.filter((player) => player.status?.toLowerCase() !== 'cut');
  const expiring = activeRoster.filter((player) => (player.contract?.yearsRemaining ?? 0) <= 1);
  const injured = activeRoster.filter((player) => /injur|reserve|pup/i.test(player.status ?? ''));
  const positions = new Map<string, number>();
  for (const player of activeRoster) {
    const position = player.position || 'Other';
    positions.set(position, (positions.get(position) ?? 0) + 1);
  }
  const topPositions = [...positions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, value]) => ({ label, value: `${value} players` }));
  const shallowPositions = [...positions.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([label, value]) => ({ label, value: `${value} on roster` }));

  const panels: Record<SupportingPanelMode, Panel[]> = {
    roster: [
      { title: 'Depth Chart', href: '/roster?view=depth', items: topPositions },
      {
        title: 'Roster Breakdown',
        items: [
          { label: 'Active roster', value: `${activeRoster.length}` },
          { label: 'Position groups', value: `${positions.size}` },
          { label: 'Open spots', value: `${Math.max(0, 53 - activeRoster.length)}` },
        ],
      },
      {
        title: 'Cap Overview',
        href: '/cap-space',
        items: [{ label: 'Available cap space', value: formatMoneyMillions(capSpace) }],
      },
      {
        title: 'Contract Status',
        href: '/roster?view=contracts',
        items: [
          { label: 'Expiring contracts', value: `${expiring.length}` },
          { label: 'Multi-year contracts', value: `${activeRoster.length - expiring.length}` },
        ],
      },
      {
        title: 'Injury Report',
        items: injured.slice(0, 3).map((player) => ({
          label: `${player.firstName} ${player.lastName}`,
          value: player.status || 'Injured',
        })),
        empty: 'No reported roster injuries.',
      },
      {
        title: 'Practice Squad',
        items: activeRoster
          .filter((player) => /practice/i.test(player.status ?? ''))
          .slice(0, 3)
          .map((player) => ({
            label: `${player.firstName} ${player.lastName}`,
            value: player.position,
          })),
        empty: 'No practice-squad players are listed.',
      },
    ],
    trade: [
      {
        title: 'Salary Cap Impact',
        href: '/cap-space',
        items: [{ label: 'Current cap space', value: formatMoneyMillions(capSpace) }],
      },
      { title: 'Trade Analysis', items: [], empty: 'Add assets to compare value and impact.' },
      {
        title: 'Recent Trade Activity',
        items: [],
        empty: 'Completed franchise trades will appear here.',
      },
    ],
    'free-agency': [
      { title: 'Team Needs', items: shallowPositions },
      {
        title: 'Cap Impact Simulator',
        href: '/cap-space',
        items: [{ label: 'Available before offers', value: formatMoneyMillions(capSpace) }],
      },
      { title: 'Recent Signings', items: [], empty: 'Accepted deals will appear here.' },
      {
        title: 'Free Agency News',
        items: [],
        empty: 'League transactions update as the market moves.',
      },
    ],
    draft: [
      { title: 'Team Needs', items: shallowPositions },
      {
        title: 'Draft Analysis',
        items: [],
        empty: 'Prospect and need analysis updates with your board.',
      },
      { title: 'Recent Mock Drafts', items: [], empty: 'Completed mocks will appear here.' },
      {
        title: 'Draft News',
        items: [],
        empty: 'Draft updates and scouting notes will appear here.',
      },
    ],
  };

  return (
    <div className={`fo-support-grid fo-support-grid-${mode}`} aria-label="Supporting insights">
      {panels[mode].map((panel) => (
        <SectionCard key={panel.title} panel={panel} />
      ))}
    </div>
  );
}
