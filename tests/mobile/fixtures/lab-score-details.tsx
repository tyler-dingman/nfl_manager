import { createRoot } from 'react-dom/client';
import { LabScore } from '../../../src/components/parlay-lab/TrendEducation';
import { ProjectionDetails } from '../../../src/components/parlay-lab/ProjectionDetails';
import { projection, empty } from './lab-score-data';

const theme = new URLSearchParams(location.search).get('team') === 'SEA' ? '#69be28' : '#ffb81c';
createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 720, margin: 'auto', padding: 16, borderTop: `4px solid ${theme}` }}>
    <LabScore score={projection.score} trend={{ projection, scoreVersion: 'v2' }} />
    <ProjectionDetails projection={projection} active={false} stat="Rushing yards" />
    <ProjectionDetails projection={empty} active stat="Rushing yards" />
  </main>,
);
