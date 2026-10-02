import { TRADE_DEADLINE_MESSAGE } from '../../../src/lib/front-office-trade-window';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TradeTarget, TradeTeamOutlook } from '../../../packages/front-office/trade-market';
import type { FrontOfficeEvent } from '../../../src/types/front-office';
import { largeDeviceStorage } from '../lib/large-device-storage';
import { franchiseRequest } from './franchise-roster';
import { SectionMenu } from './section-menu';
type Payload = {
  targets: TradeTarget[];
  outlooks: TradeTeamOutlook[];
  tradeEvents: FrontOfficeEvent[];
  recentTrades: { id: string; fromTeamAbbr?: string; toTeamAbbr?: string }[];
  deadline: { passed: boolean; label: string };
};
export function FranchiseTradeMarket({
  saveId,
  tool,
  onChoose,
}: {
  saveId: string;
  tool: string;
  onChoose: (target: TradeTarget) => void;
}) {
  const [data, setData] = useState<Payload | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [query, setQuery] = useState(''),
    [position, setPosition] = useState('ALL'),
    [selected, setSelected] = useState<TradeTarget | null>(null),
    [recent, setRecent] = useState<string[]>([]);
  const key = `dd-trade-recent-${saveId}`;
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    void franchiseRequest<Payload>(
      `/api/front-office/trade-hub?saveId=${encodeURIComponent(saveId)}`,
    )
      .then((value) => {
        if (
          !Array.isArray(value.targets) ||
          !Array.isArray(value.tradeEvents) ||
          !Array.isArray(value.recentTrades)
        )
          throw new Error('Trade intelligence is incomplete.');
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load trade intelligence.');
      });
    void largeDeviceStorage
      .get(key)
      .then((raw) => {
        const ids = JSON.parse(raw ?? '[]');
        if (active && Array.isArray(ids)) setRecent(ids);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [saveId, retry, key]);
  const open = (target: TradeTarget) => {
    setSelected(target);
    const ids = [target.id, ...recent.filter((id) => id !== target.id)].slice(0, 20);
    setRecent(ids);
    void largeDeviceStorage
      .set(key, JSON.stringify(ids))
      .catch(() => setError('Recently viewed players could not be saved.'));
  };
  const rows = (data?.targets ?? []).filter(
    (t) =>
      (tool !== 'Recently Viewed' || recent.includes(t.id)) &&
      (position === 'ALL' || t.position === position) &&
      `${t.firstName} ${t.lastName} ${t.teamAbbr}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (data?.deadline.passed)
    return (
      <View style={s.card}>
        <Text style={s.copy}>{TRADE_DEADLINE_MESSAGE}</Text>
      </View>
    );
  return (
    <View>
      <Text style={s.heading}>{tool.toUpperCase()}</Text>
      <Text style={s.copy}>
        Explore the market, build offers, and reshape your roster through trades.
      </Text>
      {!!error && (
        <Pressable style={s.card} onPress={() => setRetry((v) => v + 1)}>
          <Text accessibilityRole="alert" style={s.copy}>
            {error}
          </Text>
          <Text style={s.name}>Try again →</Text>
        </Pressable>
      )}
      {!data && !error && <ActivityIndicator color="white" />}
      {data && (
        <>
          <Text style={s.copy}>
            TRADE DEADLINE · {data.deadline.passed ? 'PASSED' : data.deadline.label}
          </Text>
          {tool === 'League Trade Activity' ? (
            <>
              {data.recentTrades.map((t) => (
                <View style={s.card} key={t.id}>
                  <Text style={s.name}>
                    {t.fromTeamAbbr ?? '—'} → {t.toTeamAbbr ?? '—'}
                  </Text>
                  <Text style={s.copy}>Completed trade</Text>
                </View>
              ))}
              {!data.recentTrades.length && (
                <Text style={s.copy}>No completed trades in this save yet.</Text>
              )}
            </>
          ) : tool === 'My Trade Offers' ? (
            <>
              {data.tradeEvents.map((event) => (
                <View style={s.card} key={event.id}>
                  <Text style={s.meta}>{event.type.replaceAll('_', ' ').toUpperCase()}</Text>
                  <Text style={s.name}>{event.headline}</Text>
                  <Text style={s.copy}>{event.summary}</Text>
                </View>
              ))}
              {!data.tradeEvents.length && (
                <Text style={s.copy}>No active offers or trade conversations.</Text>
              )}
            </>
          ) : (
            <>
              {tool === 'Find Trade Partners' &&
                (data.outlooks ?? []).map((t) => (
                  <View style={s.card} key={t.teamAbbr}>
                    <Text style={s.name}>
                      {t.teamAbbr} · {t.label}
                    </Text>
                    <Text style={s.copy}>
                      {t.record} · ${t.capSpace.toFixed(1)}M cap space
                    </Text>
                  </View>
                ))}
              <TextInput
                style={s.input}
                accessibilityLabel="Search trade targets"
                placeholder="Search trade targets"
                placeholderTextColor="#A8BAC4"
                value={query}
                onChangeText={setQuery}
              />
              <SectionMenu
                title={`Position: ${position}`}
                items={['ALL', ...new Set(data.targets.map((t) => t.position))].map((value) => ({
                  label: value,
                  selected: position === value,
                  onPress: () => setPosition(value),
                }))}
              />
              {rows.map((target) => (
                <Pressable style={s.card} key={target.id} onPress={() => open(target)}>
                  <Text style={s.name}>
                    {target.firstName} {target.lastName}
                  </Text>
                  <Text style={s.copy}>
                    {target.position} · {target.teamAbbr} · {target.rating ?? '—'} OVR
                  </Text>
                  <Text style={s.meta}>{target.whyAvailable.join('. ')}</Text>
                  <Text style={s.name}>View player →</Text>
                </Pressable>
              ))}
              {!rows.length && <Text style={s.copy}>No trade targets match this view.</Text>}
            </>
          )}
        </>
      )}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.modal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close trade target"
            style={s.button}
            onPress={() => setSelected(null)}
          >
            <Text style={s.name}>← Back to Trade Hub</Text>
          </Pressable>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {selected && (
              <>
                {selected.headshotUrl && (
                  <Image source={{ uri: selected.headshotUrl }} style={s.portrait} />
                )}
                <Text style={s.heading}>
                  {selected.firstName} {selected.lastName}
                </Text>
                <Text style={s.copy}>
                  {selected.position} · {selected.teamAbbr} · {selected.rating ?? '—'} OVR
                </Text>
                <View style={s.card}>
                  <Text style={s.name}>CONTRACT</Text>
                  <Text style={s.copy}>
                    {selected.contractSummary} · Cap hit {selected.capHit}
                  </Text>
                </View>
                <View style={s.card}>
                  <Text style={s.name}>{selected.availabilityLabel}</Text>
                  <Text style={s.copy}>Estimated cost: {selected.estimatedCost}</Text>
                  {selected.whyAvailable.map((reason) => (
                    <Text style={s.copy} key={reason}>
                      • {reason}
                    </Text>
                  ))}
                </View>
                <Pressable
                  disabled={!selected.teamAbbr || data?.deadline.passed}
                  style={s.button}
                  onPress={() => {
                    onChoose(selected);
                    setSelected(null);
                  }}
                >
                  <Text style={s.name}>
                    {data?.deadline.passed ? 'Trade deadline has passed' : 'Propose Trade →'}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontFamily: 'BarlowCondensed', fontSize: 32, color: 'white', marginVertical: 12 },
  copy: { color: '#B4C6D1', fontSize: 14, lineHeight: 22, marginVertical: 8 },
  name: { color: 'white', fontSize: 16, fontWeight: '800' },
  meta: { color: '#FFB81C', fontSize: 12, marginVertical: 8 },
  card: {
    padding: 18,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#23414E',
    borderRadius: 10,
    backgroundColor: '#061D2B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#34505F',
    borderRadius: 8,
    padding: 14,
    color: 'white',
    marginVertical: 12,
  },
  modal: { flex: 1, backgroundColor: '#001222' },
  button: {
    minHeight: 48,
    padding: 16,
    backgroundColor: '#23414E',
    borderRadius: 8,
    marginVertical: 8,
  },
  portrait: { height: 200, width: '100%', resizeMode: 'contain' },
});
