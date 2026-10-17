import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ResearchWorkspace from '../../../src/components/parlay-lab/ResearchWorkspace';
import { overviewMarket, overviewData } from './research-overview-data';
function Preview() {
  const [open, setOpen] = useState(true),
    [added, setAdded] = useState(false),
    [window, setWindow] = useState<'L5' | 'L10' | 'SEASON' | '2 YEARS'>('L10');
  const params = new URLSearchParams(location.search),
    team = params.get('team') ?? 'KC',
    state = params.get('state');
  const data = structuredClone(overviewData);
  data.player!.teamId = team;
  data.event!.homeTeamId = team;
  if (state === 'empty') {
    data.summary.projection = undefined;
    data.gameByGame = [];
    data.summary.last10 = { games: 0, hits: 0, hitRate: null };
    data.currentOpponentStrength = null;
    data.opponentVsPosition = null;
    data.gameScript = null;
  }
  if (state === 'stable')
    data.summary.projection!.roleChange = { severity: 'NONE', direction: 'UNCERTAIN' };
  return open ? (
    <ResearchWorkspace
      market={{ ...overviewMarket, teamId: team }}
      data={state === 'loading' || state === 'error' ? null : data}
      error={state === 'error' ? 'Research could not be loaded. Please try again.' : ''}
      onClose={() => setOpen(false)}
      onAdd={() => setAdded(!added)}
      added={added}
      chartWindow={window}
      setChartWindow={setWindow}
      renderDetails={(tab) => <p>{tab} detail</p>}
    />
  ) : (
    <p>Closed</p>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
