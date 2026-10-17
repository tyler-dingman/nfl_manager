import { createRoot } from 'react-dom/client';
import { DashboardContent } from '../../../src/components/parlay-lab/dashboard-content';
import { TEAM_LIST } from '../../../src/data/teams';
import type { Team } from '../../../src/features/team/team-store';
const params = new URLSearchParams(location.search);
const team = TEAM_LIST.find((t) => t.abbr === params.get('team'))!;
createRoot(document.getElementById('root')!).render(
  <div data-parlay-dashboard>
    <DashboardContent
      mode={
        params.get('screen') === 'all-props'
          ? 'all-props'
          : params.get('screen') === 'home'
            ? 'home'
            : 'trends'
      }
      team={team as unknown as Team}
      markets={(window as any).__markets}
      events={[
        {
          id: 'event',
          homeTeamId: team.abbr,
          awayTeamId: 'BUF',
          kickoffAt: '2099-10-01T23:00:00Z',
        },
      ]}
      loading={false}
      error=""
      onOpen={(market) => {
        (window as any).__opened = market;
      }}
      onAdd={(market) => {
        (window as any).__added = market;
      }}
      slip={[]}
      onRemove={() => {}}
      parlay={null}
      onGenerate={() => {}}
    />
  </div>,
);
