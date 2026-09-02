import { StyleSheet, Text, View } from 'react-native';

import {
  getEditorialVisualForStory,
  type EditorialStoryInput,
  type EditorialVisualVariant,
} from '../../../packages/editorial-visual';
import { getTeamBrandTheme } from '../../../src/lib/team-brand-themes';

export function EditorialVisual({
  story,
  teamId,
  variant = 'card',
}: {
  story: EditorialStoryInput;
  teamId?: string;
  variant?: EditorialVisualVariant;
}) {
  const data = getEditorialVisualForStory({ ...story, teamId: teamId ?? story.teamId });
  const theme = getTeamBrandTheme(data.teamId);
  const compact = variant === 'compact';
  return (
    <View
      accessible
      accessibilityLabel={`${data.eyebrow}: ${data.primaryText}`}
      style={[
        s.root,
        compact ? s.compact : variant === 'hero' ? s.hero : s.card,
        { backgroundColor: theme.primary },
      ]}
    >
      <View style={[s.rule, { backgroundColor: theme.secondary }]} />
      <View style={s.top}>
        <Text style={s.eyebrow}>{data.eyebrow}</Text>
        <Text style={s.brand}>{data.teamId} · D&amp;D</Text>
      </View>
      <View>
        {data.number ? <Text style={s.number}>#{data.number}</Text> : null}
        <Text
          numberOfLines={compact ? 2 : 3}
          style={[s.action, compact && s.actionCompact, { color: theme.light }]}
        >
          {data.visualType === 'STAT' && data.value
            ? data.value
            : data.action || data.status || data.primaryText}
        </Text>
        {data.action || data.status || data.value ? (
          <Text numberOfLines={2} style={s.title}>
            {data.primaryText}
          </Text>
        ) : null}
      </View>
      <View style={s.ticks}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <View
            key={i}
            style={[s.tick, { backgroundColor: theme.secondary, height: i % 3 === 0 ? 12 : 6 }]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { overflow: 'hidden', position: 'relative', justifyContent: 'space-between', padding: 18 },
  card: { minHeight: 180 },
  compact: { minHeight: 132, padding: 14 },
  hero: { minHeight: 240, padding: 22 },
  rule: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  brand: { color: 'rgba(255,255,255,.72)', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  action: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '900',
    textTransform: 'uppercase',
    maxWidth: '92%',
  },
  actionCompact: { fontSize: 23, lineHeight: 24 },
  title: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 6,
    maxWidth: '88%',
  },
  number: {
    position: 'absolute',
    right: 0,
    bottom: -12,
    color: 'rgba(255,255,255,.14)',
    fontSize: 72,
    fontWeight: '900',
  },
  ticks: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tick: { width: 2 },
});
