import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { C, Eyebrow, Heading } from '../../components/screen';
import type { Story } from '../../lib/types';
import { getSavedContent, removeSavedContent, saveStory } from '../../lib/api';
import { EditorialVisual } from '../../components/editorial-visual';
import { useTeam } from '../../lib/team-context';
export default function Detail() {
  const { teamId } = useTeam();
  const [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  let story: Story | null = null;
  try {
    story = payload ? JSON.parse(payload) : null;
  } catch {}
  const storyId = story?.id;
  useEffect(() => {
    let active = true;
    if (!storyId) return;
    void getSavedContent()
      .then((items) => {
        if (active) setSaved(items.some((item) => item.contentType === 'STORY' && item.contentId === storyId));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [storyId]);
  if (!story)
    return (
      <View style={s.page}>
        <Heading>Story unavailable</Heading>
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
          } finally {
            setSaving(false);
          }
        }}
      >
        <Text style={s.saveText}>{saving ? 'UPDATING…' : saved ? 'SAVED ✓ · REMOVE' : 'SAVE STORY'}</Text>
      </Pressable>
      <Text style={s.summary}>{story.summary}</Text>
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
  page: { flex: 1, backgroundColor: C.cream },
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
  text: { fontSize: 16, lineHeight: 24, color: C.ink, marginTop: 8 },
  source: { backgroundColor: C.navy, padding: 18, borderRadius: 16, marginTop: 24 },
  sourceLabel: { fontSize: 13, fontWeight: '900', color: C.gold },
  sourceName: { fontSize: 16, fontWeight: '900', color: C.white, marginTop: 5 },
});
