import { normalizeDisplayHeadline } from '../../../src/lib/display-headline';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BeatArtwork } from './beat-artwork';
import { resolveBeatArtwork } from '../../../packages/beat/article-hero';
import { router, type Href } from 'expo-router';
import { beatPalette } from '../../../src/components/beat/beat-model';
import type { Briefing } from '../lib/types';
import CrewShareModal from './crew-share-modal';
export function openHomeBriefing(item: Briefing) {
  router.push(
    `/beat-story/${item.id}?payload=${encodeURIComponent(JSON.stringify({ ...item, sourceCount: item.sources.length }))}` as Href,
  );
}
export function HomeBeatCard({ item, teamId }: { item: Briefing; teamId: string }) {
  const [share, setShare] = useState(false),
    [sources, setSources] = useState(false);
  const palette = beatPalette(teamId);
  const decision = resolveBeatArtwork({ ...item, teamAbbr: item.teamAbbr ?? teamId });
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(item.updatedAt)) / 60000));
  const age = !Number.isFinite(minutes)
    ? ''
    : minutes < 1
      ? 'now'
      : minutes < 60
        ? `${minutes}m`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)}h`
          : `${Math.floor(minutes / 1440)}d`;
  return (
    <View style={s.card} testID={`home-beat-${item.id}`}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="link"
        accessibilityLabel={`Open story: ${normalizeDisplayHeadline(item.headline)}`}
        onPress={() => openHomeBriefing(item)}
      />
      <View pointerEvents="none">
        <View style={{ borderTopWidth: 3, borderTopColor: palette.accent }}>
          <BeatArtwork decision={decision} teamId={teamId} />
          <Text style={s.artworkCategory}>{decision.displayCategory.toUpperCase()}</Text>
        </View>
        <View style={s.body}>
          <Text style={s.title}>{normalizeDisplayHeadline(item.headline)}</Text>
          <Text style={s.summary}>{item.summary}</Text>
        </View>
      </View>
      <View style={s.footer} pointerEvents="box-none">
        <Pressable accessibilityRole="button" onPress={() => setSources(!sources)}>
          <Text style={s.meta}>
            {item.sources.length} SOURCE{item.sources.length === 1 ? '' : 'S'}
            {age ? ` · UPDATED ${age.toUpperCase()}${age === 'now' ? '' : ' AGO'}` : ''}
          </Text>
        </Pressable>
        {sources &&
          item.sources.map((source) => (
            <Pressable key={source.id} onPress={() => void Linking.openURL(source.url)}>
              <Text style={s.summary}>{source.publisher} ↗</Text>
            </Pressable>
          ))}
        <View style={s.actions} pointerEvents="box-none">
          <Pressable accessibilityRole="button" onPress={() => setShare(true)}>
            <Text style={s.share}>♧ Share with the Crew</Text>
          </Pressable>
          <Pressable accessibilityLabel="Open story" onPress={() => openHomeBriefing(item)}>
            <Text style={s.share}>→</Text>
          </Pressable>
        </View>
      </View>
      <CrewShareModal
        visible={share}
        onClose={() => setShare(false)}
        content={{
          contentId: item.id,
          contentType: 'BEAT_STORY',
          href: `/content/${item.id}`,
          title: item.headline,
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DBE4ED',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  artworkCategory: {
    position: 'absolute',
    top: 12,
    left: 18,
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  graphic: { aspectRatio: 320 / 180, backgroundColor: '#0B1115', borderTopWidth: 3 },
  body: { padding: 16 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#071C49' },
  summary: { fontSize: 14, lineHeight: 21, color: '#486A9C', marginTop: 10 },
  footer: { paddingHorizontal: 16, paddingBottom: 16 },
  meta: { fontSize: 10, letterSpacing: 1, color: '#537DB2', marginTop: 10, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    minHeight: 44,
  },
  share: { color: '#071C49', fontSize: 12, fontWeight: '600' },
});
