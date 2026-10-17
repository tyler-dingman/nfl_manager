import { router, useLocalSearchParams } from 'expo-router';
import { usePropMarketNavigation } from '../../../apps/mobile/lib/prop-market-navigation';
import { availableMarketFacets } from '../../../packages/parlay/market-navigation';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PropDiscoveryTable,
  PropMarketNavigation,
} from '../../../apps/mobile/components/prop-discovery-table';
import { queryPropCatalog } from '../../../packages/parlay/prop-catalog';
import { addSlipLeg } from '../../../packages/parlay/slip';
const trend = (score, eligible = true) => ({
  trendScore: score,
  projection: {
    modelScore: score,
    projection: 8,
    estimatedProbability: 0.8,
    recommendation: 'OVER',
    dataQuality: { reliability: 0.9, currentRoleKnown: eligible, freshness: 1 },
  },
  last10: { hits: 8, games: 10, hitRate: 80 },
});
const main = {
  id: 'main',
  eventId: 'e',
  playerId: 'player',
  playerName: 'Player One',
  teamId: 'KC',
  period: 'game',
  marketType: 'RECEPTIONS',
  side: 'OVER',
  line: 3.5,
  lineType: 'main',
  available: true,
  odds: -110,
  sportsbook: 'DRAFTKINGS',
  trend: trend(80),
};
const rows = [
  main,
  { ...main, id: 'alt', line: 2.5, lineType: 'alternate', odds: -145, trend: trend(85) },
  { ...main, id: 'bad', line: 1.5, lineType: 'alternate', trend: trend(99, false) },
];
const events = [{ id: 'e', homeTeamId: 'KC', awayTeamId: 'BUF', kickoffAt: '2099-10-01' }];
function App() {
  const { view: routeView } = useLocalSearchParams();
  const view = routeView ?? 'all-props';
  const { category, market, onCategory, onMarket } = usePropMarketNavigation(
    view,
    availableMarketFacets(rows),
  );
  const [slip, setSlip] = useState([]);
  const catalog = queryPropCatalog(
    rows,
    events,
    new URLSearchParams({ grouped: 'true', altLines: 'true', view, category, market }),
  );
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100, backgroundColor: '#00141e' }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.setParams({ view: view === 'trends' ? 'all-props' : 'trends' })}
        >
          <Text style={{ color: 'white', padding: 15 }}>
            Open {view === 'trends' ? 'All Props' : 'Trending Props'}
          </Text>
        </Pressable>
        <PropMarketNavigation
          facets={catalog.facets}
          category={category}
          market={market}
          onCategory={onCategory}
          onMarket={onMarket}
          accent="#e31837"
        />
        <PropDiscoveryTable
          groups={catalog.groups}
          events={events}
          slip={slip}
          onOpen={(m) => (window.__opened = m)}
          onAdd={(m) => {
            window.__added = m;
            setSlip((current) => addSlipLeg(current, m));
          }}
          accent="#e31837"
        />
        <Text style={{ color: 'white' }}>My Parlay: {slip.map((m) => m.id).join(',')}</Text>
      </ScrollView>
    </SafeAreaProvider>
  );
}
createRoot(document.getElementById('root')).render(<App />);
