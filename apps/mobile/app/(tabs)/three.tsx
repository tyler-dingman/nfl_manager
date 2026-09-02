import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../../components/screen';
import { StoryCard } from '../../components/story-card';
import { getThree } from '../../lib/api';
import type { Story } from '../../lib/types';
import { useTeam } from '../../lib/team-context';
export default function Three() {
  const { teamId } = useTeam();
  const [stories, setStories] = useState<Story[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStories((await getThree(teamId)).current.stories);
    } catch (caught) {
      setStories([]);
      setError(caught instanceof Error ? caught.message : 'Three and Out is unavailable.');
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
      <Eyebrow>WHAT MATTERS RIGHT NOW</Eyebrow>
      <Heading>Three and Out</Heading>
      <Text style={s.intro}>The three biggest team stories, ranked, sourced, and explained.</Text>
      {error ? <View style={s.state}><Text style={s.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.retry}>TRY AGAIN →</Text></Pressable></View> : null}
      {stories.map((story, i) => (
        <StoryCard key={story.id} story={story} down={`${['1ST', '2ND', '3RD'][i]} DOWN`} />
      ))}
      {!loading && !error && stories.length === 0 ? <Text style={s.empty}>No stories are ready yet. Pull down to check again.</Text> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { backgroundColor: C.cream },
  body: { padding: 18, paddingBottom: 40 },
  intro: { color: C.muted, lineHeight: 21, marginTop: 10, marginBottom: 22 },
  state: { backgroundColor: C.white, borderRadius: 14, padding: 18 },
  error: { color: C.muted, lineHeight: 20 },
  retry: { color: C.red, fontSize: 13, fontWeight: '900', marginTop: 12 },
  empty: { color: C.muted, lineHeight: 20 },
});
