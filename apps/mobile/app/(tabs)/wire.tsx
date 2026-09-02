import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../../components/screen';
import { getWire } from '../../lib/api';
import type { WireEntry } from '../../lib/types';
import { useTeam } from '../../lib/team-context';
import { useTeamBranding } from '../../lib/team-branding';
export default function Wire() {
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const [items, setItems] = useState<WireEntry[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getWire(teamId));
    } catch (caught) {
      setItems([]);
      setError(caught instanceof Error ? caught.message : 'The Wire is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Eyebrow>LIVE TEAM ACTIVITY</Eyebrow>
      <Heading>The Wire</Heading>
      <Text style={s.intro}>Meaningful updates—not every repeated article.</Text>
      {error ? <View style={s.state}><Text style={s.summary}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.source}>TRY AGAIN →</Text></Pressable></View> : null}
      {items.map((item) => (
        <View key={item.id} style={s.item}>
          <View style={[s.dot, { backgroundColor: theme.primary }]} />
          <Text style={s.time}>{new Date(item.occurredAt).toLocaleString()}</Text>
          <Text style={[s.type, { color: theme.primary }]}>{item.type}</Text>
          <Text style={s.title}>{item.headline}</Text>
          <Text style={s.summary}>{item.summary}</Text>
          {item.primarySource?.url ? (
            <Pressable onPress={() => Linking.openURL(item.primarySource!.url)}>
              <Text style={s.source}>{item.primarySource.name} · GO TO SOURCE →</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {!loading && !error && items.length === 0 ? <Text style={s.empty}>No new Wire updates are available.</Text> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { backgroundColor: C.cream },
  body: { padding: 18, paddingBottom: 40 },
  intro: { color: C.muted, marginTop: 10, marginBottom: 22 },
  item: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    left: -5,
    top: 20,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  time: { fontSize: 13, fontWeight: '800', color: C.muted },
  type: { fontSize: 13, fontWeight: '900', marginTop: 7 },
  title: { fontSize: 19, fontWeight: '900', color: C.ink, marginTop: 6 },
  summary: { color: C.muted, lineHeight: 19, marginTop: 6 },
  source: { fontSize: 13, fontWeight: '900', color: C.ink, marginTop: 12 },
  state: { backgroundColor: C.white, borderRadius: 16, padding: 18 },
  empty: { color: C.muted, lineHeight: 20 },
});
