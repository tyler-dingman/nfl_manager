import { PageScrollView as ScrollView } from '../../components/page-scroll-view';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { C, Eyebrow, Heading } from '../../components/screen';
import type { Story } from '../../lib/types';
import { getSavedContent, removeSavedContent, saveStory } from '../../lib/api';
import { EditorialVisual } from '../../components/editorial-visual';
import { authenticatedFetch } from '../../lib/auth';
import { useTeam } from '../../lib/team-context';
export default function Detail() {
  const { teamId } = useTeam();
  const [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { payload, id } = useLocalSearchParams<{ payload?: string; id?: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const parsed = payload ? (JSON.parse(payload) as Story) : null;
        if (parsed?.id) {
          if (active) setStory(parsed);
          return;
        }
        if (!id) throw new Error('Story unavailable.');
        const response = await authenticatedFetch(`/api/mobile/stories/${encodeURIComponent(id)}`);
        if (!response.ok) throw new Error('This story is unavailable.');
        const result = await response.json();
        if (active) setStory(result);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load story.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [payload, id]);
  const storyId = story?.id;
  useEffect(() => {
    let active = true;
    if (!storyId) return;
    void getSavedContent()
      .then((items) => {
        if (active)
          setSaved(
            items.some((item) => item.contentType === 'STORY' && item.contentId === storyId),
          );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storyId]);
  if (loading)
    return (
      <View style={s.body}>
        <ActivityIndicator />
      </View>
    );
  if (!story)
    return (
      <View style={s.page}>
        <Heading>Story unavailable</Heading>
        <Text style={s.text}>{error}</Text>
      </View>
    );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <EditorialVisual
        story={{
          teamId: story.teamId || teamId,
          storyType: story.storyType,
          headline: story.title,
          summary: story.summary,
          status: story.status,
          visualType: story.visualType,
        }}
        variant="hero"
      />
      <Eyebrow>{story.status}</Eyebrow>
      <Heading>{story.title}</Heading>
      <Text style={s.timestamp}>
        Updated {new Date(story.lastMaterialUpdateAt).toLocaleString()}
      </Text>
      <Pressable
        style={s.save}
        disabled={saving}
        onPress={async () => {
          if (!story) return;
          setSaving(true);
          try {
            if (saved) {
              await removeSavedContent('STORY', story.id);
              setSaved(false);
            } else {
              await saveStory(story);
              setSaved(true);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to update saved story.');
          } finally {
            setSaving(false);
          }
        }}
      >
        <Text style={s.saveText}>
          {saving ? 'UPDATING…' : saved ? 'SAVED ✓ · REMOVE' : 'SAVE STORY'}
        </Text>
      </Pressable>
      <Text accessibilityRole="alert" style={s.saveText}>
        {error}
      </Text>
      <Section title="WHAT HAPPENED" body={story.summary} />
      <Section title="WHY IT MATTERS" body={story.whyItMatters} />
      <Section title="WHAT'S NEXT" body={story.whatsNext} />
      {story.sources.map((source) => (
        <Pressable
          key={source.id}
          style={s.source}
          onPress={() => Linking.openURL(source.sourceUrl)}
        >
          <Text style={s.sourceLabel}>
            {source.isOfficialSource ? 'OFFICIAL SOURCE' : 'SOURCE'}
          </Text>
          <Text style={s.sourceName}>{source.sourceName} →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function Section({ title, body }: { title: string; body: string }) {
  return body ? (
    <View style={s.section}>
      <Text style={s.label}>{title}</Text>
      <Text style={s.text}>{body}</Text>
    </View>
  ) : null;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 20, paddingBottom: 40, gap: 12 },
  summary: { fontSize: 18, lineHeight: 26, color: C.muted, marginTop: 16 },
  timestamp: { color: C.muted, fontSize: 13, marginTop: 10 },
  save: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 16,
  },
  saveText: { color: C.red, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  section: { marginTop: 28 },
  label: { fontSize: 13, letterSpacing: 1.5, fontWeight: '900', color: C.red },
  text: { fontSize: 14, lineHeight: 24, color: C.ink, marginTop: 8 },
  source: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 20,
    marginTop: 12,
  },
  sourceLabel: { fontSize: 13, fontWeight: '900', color: C.muted },
  sourceName: { fontSize: 16, fontWeight: '900', color: C.ink, marginTop: 5 },
});
