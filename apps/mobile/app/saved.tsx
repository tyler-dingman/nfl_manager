import { PageScrollView } from '../components/page-scroll-view';
import { PageHeading, PageState } from '../components/page-heading';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSavedContent, type SavedItem } from '../lib/api';
import { useTeamBranding } from '../lib/team-branding';
export default function Saved() {
  const { theme } = useTeamBranding();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getSavedContent());
    } catch {
      setError('Unable to load saved stories. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const open = (item: SavedItem) => {
    if (item.contentType === 'BEAT_STORY')
      router.push({ pathname: '/beat-story/[id]', params: { id: item.contentId } });
    else if (item.contentType === 'STORY')
      router.push({ pathname: '/story/[id]', params: { id: item.contentId } });
    else router.push('/beat');
  };
  return (
    <PageScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <PageHeading
        eyebrow="YOUR LIBRARY"
        title="Saved stories"
        description="Keep important reporting and briefings close."
      />
      {loading && <ActivityIndicator color={theme.primaryFill} />}
      {error ? (
        <PageState title="Saved stories unavailable" message={error} />
      ) : !loading && !items.length ? (
        <View style={s.empty}>
          <Feather name="bookmark" size={32} color={theme.primaryFill} />
          <Text style={s.title}>No saved stories yet.</Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => router.push('/beat')}
          >
            <Text style={s.buttonText}>Browse The Beat →</Text>
          </Pressable>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            style={s.card}
            onPress={() => open(item)}
          >
            <Text style={[s.type, { color: theme.primaryFill }]}>
              {item.contentType.replaceAll('_', ' ')}
            </Text>
            <Text style={s.title}>{item.title}</Text>
          </Pressable>
        ))
      )}
    </PageScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 20, paddingBottom: 40 },
  card: {
    borderWidth: 1,
    borderColor: '#00172B1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  type: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { fontSize: 20, fontWeight: '800', color: '#00172B', marginTop: 10 },
  empty: { backgroundColor: '#F7F4EE', borderRadius: 24, padding: 32, alignItems: 'center' },
  button: {
    backgroundColor: '#00172B',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 20,
  },
  buttonText: { color: 'white', fontWeight: '800' },
});
