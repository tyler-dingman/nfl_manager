import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from './screen';
import type { Story } from '../lib/types';
import { EditorialVisual } from './editorial-visual';
import { useTeam } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';
export function StoryCard({ story, down }: { story: Story; down?: string }) {
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/story/[id]',
          params: { id: story.id, payload: JSON.stringify(story) },
        })
      }
      style={s.card}
    >
      <EditorialVisual
        story={{
          teamId: story.teamId || teamId,
          storyType: story.storyType,
          headline: story.title,
          summary: story.summary,
          status: story.status,
          visualType: story.visualType,
        }}
        variant="compact"
      />
      <View style={s.content}>
        {down ? <Text style={[s.down, { color: theme.primary }]}>{down}</Text> : null}
        <View style={s.row}>
          <Text style={[s.status, { color: theme.primary }]}>{story.status.replaceAll('_', ' ')}</Text>
          <Text style={s.score}>{story.importanceScore}</Text>
        </View>
        <Text style={s.title}>{story.title}</Text>
        <Text style={s.summary}>{story.summary}</Text>
        <Text style={s.source}>{story.sources[0]?.sourceName ?? 'Down & Distance'} →</Text>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5DED3',
  },
  content: { padding: 18 },
  down: { fontSize: 13, fontWeight: '900', letterSpacing: 1.6, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { fontSize: 13, fontWeight: '900' },
  score: { fontSize: 13, fontWeight: '900', color: C.muted },
  title: { fontSize: 20, lineHeight: 23, fontWeight: '900', color: C.ink, marginTop: 9 },
  summary: { fontSize: 16, lineHeight: 23, color: C.muted, marginTop: 8 },
  source: { fontSize: 13, fontWeight: '900', color: C.ink, marginTop: 14 },
});
