import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollView, Text, Pressable } from 'react-native';
import { ParlayDiscoveryControls } from '../../../apps/mobile/components/parlay-discovery-controls';
import { useDiscoveryPreferences } from '../../../apps/mobile/lib/parlay-discovery-preferences';
function App() {
  const [team, setTeam] = useState(false);
  const [screen, setScreen] = useState('Trending');
  const p = useDiscoveryPreferences();
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 100, backgroundColor: '#00141e' }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => setScreen(screen === 'Trending' ? 'Home' : 'Trending')}
      >
        <Text style={{ color: 'white' }}>Open {screen === 'Trending' ? 'Home' : 'Trending'}</Text>
      </Pressable>
      <Text style={{ color: 'white' }}>{screen}</Text>
      <ParlayDiscoveryControls key={screen} myTeamOnly={team} onTeamChange={setTeam} />
      <Text style={{ color: 'white' }}>
        Mode: {p.altLines ? 'Alternate' : 'Standard'} / {p.maxOdds}
      </Text>
    </ScrollView>
  );
}
createRoot(document.getElementById('root')).render(<App />);
