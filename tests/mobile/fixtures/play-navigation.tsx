import { createRoot } from 'react-dom/client';
import PrimaryNavigation from '../../../src/components/primary-navigation';
import TeamThemeProvider from '../../../src/components/team-theme-provider';
import { useTeamStore } from '../../../src/features/team/team-store';
const team = useTeamStore
  .getState()
  .teams.find((t) => t.abbr === new URLSearchParams(location.search).get('team'));
createRoot(document.getElementById('root')!).render(
  <TeamThemeProvider team={team}>
    <PrimaryNavigation teamAbbr={team?.abbr} />
    <button style={{ marginTop: 100 }}>Outside</button>
  </TeamThemeProvider>,
);
