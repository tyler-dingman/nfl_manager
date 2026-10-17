import { createRoot } from 'react-dom/client';
import { ScrollView, View } from 'react-native';
import { ProjectionDetails } from '../../../apps/mobile/components/projection-details';
import { projection, empty } from './lab-score-data';
createRoot(document.getElementById('root')).render(
  <ScrollView
    style={{ height: '100%' }}
    contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
  >
    <ProjectionDetails projection={projection} active stat="Rushing yards" />
    <ProjectionDetails projection={empty} active={false} stat="Rushing yards" />
    <View testID="content-end" style={{ height: 1 }} />
  </ScrollView>,
);
