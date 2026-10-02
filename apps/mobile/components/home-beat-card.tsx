import { normalizeDisplayHeadline } from '../../../src/lib/display-headline';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { router, type Href } from 'expo-router';
import { beatPalette } from '../../../src/components/beat/beat-model';
import layers from '../assets/beat/editorial-layers.json';
import type { Briefing } from '../lib/types';
import CrewShareModal from './crew-share-modal';
export function openHomeBriefing(item: Briefing) {
  router.push(
    `/beat-story/${item.id}?payload=${encodeURIComponent(JSON.stringify({ ...item, sourceCount: item.sources.length }))}` as Href,
  );
}
export function HomeBeatCard({ item, teamId }: { item: Briefing; teamId: string }) {
  const [share, setShare] = useState(false),
    [sources, setSources] = useState(false),
    [width, setWidth] = useState(360);
  const palette = beatPalette(teamId);
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
        accessibilityRole="button"
        accessibilityLabel={`Open story: ${normalizeDisplayHeadline(item.headline)}`}
        onPress={() => openHomeBriefing(item)}
      >
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={[s.graphic, { borderTopColor: palette.accent }]}
        >
          {layers.map((layer) => (
            <View
              key={layer.id}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: layer.opacity }]}
            >
              <SvgXml
                width="100%"
                height="100%"
                xml={layer.xml.replaceAll(
                  'currentColor',
                  layer.id === 'diagonal-accent-stripes' ? palette.accent : '#FFFFFF',
                )}
              />
            </View>
          ))}
          <Text
            style={{
              position: 'absolute',
              left: '6.25%',
              top: '33.88%',
              fontFamily: 'BarlowCondensed',
              fontSize: width / 6,
              color: '#FFFFFF16',
            }}
          >
            EDITORIAL
          </Text>
          <View
            style={{
              position: 'absolute',
              left: '7.5%',
              top: '82.7%',
              width: '36%',
              height: 2,
              backgroundColor: palette.accent,
              opacity: 0.45,
            }}
          />
          <Text
            style={{
              position: 'absolute',
              left: '76.875%',
              top: '66.1%',
              fontFamily: 'BarlowCondensed',
              fontSize: width * 0.075,
              color: 'white',
            }}
          >
            {teamId}
          </Text>
          <View
            style={{
              position: 'absolute',
              left: '4.375%',
              top: '7.22%',
              width: '1.25%',
              height: '10%',
              backgroundColor: palette.accent,
            }}
          />
          <Text
            style={{
              position: 'absolute',
              left: '8.75%',
              top: '7.22%',
              fontFamily: 'BarlowCondensed',
              fontSize: width * 0.035,
              color: 'white',
              letterSpacing: 1,
            }}
          >
            EDITORIAL
          </Text>
          <Text
            style={{
              position: 'absolute',
              right: '5%',
              top: '7.22%',
              fontFamily: 'BarlowCondensed',
              fontSize: width * 0.035,
              color: 'white',
            }}
          >
            {age.toUpperCase()}
          </Text>
        </View>
        <View style={s.body}>
          <Text style={s.title}>{normalizeDisplayHeadline(item.headline)}</Text>
          <Text style={s.summary}>{item.summary}</Text>
        </View>
      </Pressable>
      <View style={s.footer}>
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
        <View style={s.actions}>
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
