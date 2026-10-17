import { LabScoreHelp } from '../../../apps/mobile/components/lab-score-help';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, Pressable } from 'react-native';
import { ParlaySlip } from '../../../apps/mobile/components/parlay-slip';
const market = {
  id: 'p',
  playerId: 'p',
  playerName: 'Player One',
  teamId: 'KC',
  eventId: 'e',
  marketType: 'RECEPTIONS',
  side: 'OVER',
  line: 4.5,
  odds: -200,
  sportsbook: 'FANDUEL',
  available: true,
  deeplink: null,
  trend: { trendScore: 84, last10: { games: 10, hits: 8, hitRate: 80 } },
};
function App() {
  const [legs, setLegs] = useState([]);
  return (
    <View style={{ flex: 1, backgroundColor: '#00141e' }}>
      <View style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" onPress={() => setLegs([market])}>
          <Text style={{ color: 'white' }}>Add first</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setLegs(
              Array.from({ length: 16 }, (_, i) => ({
                ...market,
                id: `leg${i}`,
                playerName: `Player ${i}`,
              })),
            )
          }
        >
          <Text style={{ color: 'white' }}>Add long parlay</Text>
        </Pressable>
      </View>
      <LabScoreHelp />
      <ParlaySlip
        accent={
          new URLSearchParams(window.location.search).get('team') === 'SEA' ? '#69be28' : '#e31837'
        }
        legs={legs}
        setLegs={setLegs}
        events={[
          {
            id: 'e',
            week: 5,
            homeTeamId: 'KC',
            awayTeamId: 'BUF',
            kickoffAt: '2099-10-10T12:00:00Z',
          },
        ]}
        onOpen={() => {}}
      />
      <View testID="bottom-nav" style={{ height: 75, backgroundColor: '#12313f' }}>
        <Text style={{ color: 'white' }}>Bottom navigation</Text>
      </View>
    </View>
  );
}
createRoot(document.getElementById('root')).render(<App />);
