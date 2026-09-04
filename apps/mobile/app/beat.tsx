import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getBeat, type MobileBriefing } from '../lib/api';
import { useTeam } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';

export default function BeatScreen() {
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const [items, setItems] = useState<MobileBriefing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getBeat(teamId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The Beat is unavailable.');
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
      <Eyebrow>{teamId} · THE BEAT</Eyebrow>
      <Heading>What matters right now.</Heading>
      <Text style={s.intro}>
        One living story for each development, sourced and updated as the facts change.
      </Text>
      {loading && !items.length ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {items.map((item) => {
        const hot = Boolean(item.hotReadUntil && new Date(item.hotReadUntil) > new Date());
        return (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() =>
              router.push(
                `/beat-story/${item.id}?payload=${encodeURIComponent(JSON.stringify(item))}` as Href,
              )
            }
            style={s.card}
          >
            <View style={s.row}>
              <Text style={[s.category, { color: theme.primary }]}>
                {hot ? 'HOT READ' : item.category}
              </Text>
              <Text style={s.meta}>
                {item.sourceCount} SOURCE{item.sourceCount === 1 ? '' : 'S'}
              </Text>
            </View>
            <Text style={s.title}>{item.headline}</Text>
            <Text style={s.summary} numberOfLines={3}>
              {item.summary}
            </Text>
            <Text style={[s.open, { color: theme.primary }]}>OPEN D&D STORY →</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 18, paddingBottom: 40 },
  intro: { color: C.muted, lineHeight: 21, marginTop: 10, marginBottom: 22 },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5DED3',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  meta: { fontSize: 11, fontWeight: '800', color: C.muted },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '900', color: C.ink, marginTop: 9 },
  summary: { fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 8 },
  open: { fontSize: 12, fontWeight: '900', marginTop: 15 },
  error: { color: C.red, fontWeight: '700', marginBottom: 16 },
});
