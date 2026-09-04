import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { C, Eyebrow, Heading } from '../../components/screen';
import { getBeatStory, type MobileBriefing } from '../../lib/api';
import { useTeam } from '../../lib/team-context';
import CrewShareModal from '../../components/crew-share-modal';

export default function BeatStoryScreen() {
  const { teamId } = useTeam();
  const { id, payload } = useLocalSearchParams<{ id: string; payload?: string }>();
  const [message, setMessage] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [story, setStory] = useState<MobileBriefing | null>(() => {
    try {
      return payload ? JSON.parse(payload) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!story);
  useEffect(() => {
    if (story || !id) return;
    void getBeatStory(id, teamId)
      .then(setStory)
      .finally(() => setLoading(false));
  }, [id, story, teamId]);
  if (!story)
    return (
      <View style={s.page}>
        <Heading>{loading ? 'Loading story…' : 'Story unavailable'}</Heading>
      </View>
    );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <Eyebrow>{story.category}</Eyebrow>
      <Heading>{story.headline}</Heading>
      <Text style={s.updated}>
        Updated {new Date(story.updatedAt).toLocaleString()} · {story.sourceCount} sources
      </Text>
      <Text style={s.summary}>{story.summary}</Text>
      {story.whyItMatters ? (
        <View style={s.section}>
          <Text style={s.label}>WHY IT MATTERS</Text>
          <Text style={s.copy}>{story.whyItMatters}</Text>
        </View>
      ) : null}
      <View style={s.actions}>
        <Pressable style={s.action} onPress={() => setShareOpen(true)}>
          <Text style={s.actionText}>SHARE WITH THE CREW</Text>
        </Pressable>
        <Pressable
          style={s.action}
          onPress={() =>
            void Share.share({ message: `${story!.headline}\n${story!.sources[0]?.url ?? ''}` })
          }
        >
          <Text style={s.actionText}>SHARE</Text>
        </Pressable>
      </View>
      {message ? <Text style={s.message}>{message}</Text> : null}
      <Text style={s.label}>SOURCES</Text>
      {story.sources.map((source) => (
        <Pressable
          key={source.id}
          style={s.source}
          onPress={() => void Linking.openURL(source.url)}
        >
          <Text style={s.sourceName}>{source.publisher} →</Text>
          <Text style={s.sourceTitle}>{source.title ?? 'Read original reporting'}</Text>
        </Pressable>
      ))}
      <CrewShareModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={setMessage}
        content={{
          contentType: 'BEAT_STORY',
          contentId: story.id,
          href: `/the-beat?story=${story.id}`,
          title: story.headline,
        }}
      />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 40 },
  updated: { color: C.muted, fontSize: 12, marginTop: 10 },
  summary: { fontSize: 18, lineHeight: 27, color: C.ink, marginTop: 24 },
  section: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginVertical: 22 },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, color: C.red, marginTop: 22 },
  copy: { color: C.muted, lineHeight: 23, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  action: {
    minHeight: 48,
    flex: 1,
    borderRadius: 14,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: C.white, fontSize: 12, fontWeight: '900' },
  message: { color: C.muted, fontWeight: '700', marginTop: 12 },
  source: { backgroundColor: C.white, borderRadius: 14, padding: 16, marginTop: 9 },
  sourceName: { fontWeight: '900', color: C.ink },
  sourceTitle: { color: C.muted, marginTop: 4 },
});
