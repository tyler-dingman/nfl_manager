import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Text as SvgText, SvgXml } from 'react-native-svg';
import { beatPalette } from '../../../src/components/beat/beat-model';
import type { BeatGraphicDecision } from '../../../src/components/beat/beat-story-adapter';
import { beatArtworkMotif, beatLayerOpacity } from '../../../packages/beat/article-hero';
import manifest from '../../../public/assets/the-beat-asset-library/manifest.json';
import library from '../assets/beat/library.json';

export function BeatArtwork({
  decision,
  teamId,
  backgroundOnly = false,
}: {
  decision: BeatGraphicDecision;
  teamId: string;
  backgroundOnly?: boolean;
}) {
  const [width, setWidth] = useState(320);
  const palette = beatPalette(teamId);
  const motif = beatArtworkMotif(decision.graphic, decision.displayCategory, palette.team ?? 'NFL');
  return (
    <View
      testID={`beat-artwork-${decision.graphic.family}`}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={s.artwork}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {motif.layers.map((id) => {
        const asset = manifest.assets.find((a) => a.id === id)!;
        return (
          <View
            key={id}
            style={[StyleSheet.absoluteFill, { opacity: beatLayerOpacity(id, asset.cssOpacity) }]}
          >
            <SvgXml
              width="100%"
              height="100%"
              xml={library[id as keyof typeof library].replaceAll(
                'currentColor',
                asset.colorRole === 'accent' ? palette.accent : '#fff',
              )}
            />
          </View>
        );
      })}
      {!backgroundOnly && (
        <View style={s.foreground}>
          <View style={s.primaryRow}>
            {motif.teams[0] && <TeamMark team={motif.teams[0]} />}
            {motif.outline ? (
              <Svg width={width * 0.43} height={width * 0.3} viewBox="0 0 150 100">
                <SvgText
                  x="2"
                  y="83"
                  fontFamily="BarlowCondensed"
                  fontWeight="700"
                  fontSize="100"
                  fill="transparent"
                  stroke={palette.accent}
                  strokeWidth="1"
                >
                  {motif.primary}
                </SvgText>
              </Svg>
            ) : (
              <Text
                adjustsFontSizeToFit
                numberOfLines={2}
                style={[
                  s.primary,
                  {
                    fontSize: motif.primary.length > 12 ? width * 0.12 : width * 0.18,
                    color: decision.graphic.family === 'injury' ? palette.accent : '#fff',
                  },
                ]}
              >
                {motif.primary}
              </Text>
            )}
            {motif.teams[1] && <TeamMark team={motif.teams[1]} />}
          </View>
          <Text numberOfLines={2} style={[s.secondary, { fontSize: width * 0.06 }]}>
            {motif.secondary.replaceAll('\n', ' ')}
          </Text>
          {!!motif.detail && (
            <Text numberOfLines={2} style={s.detail}>
              {motif.detail}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
function TeamMark({ team }: { team: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Text style={s.secondary}>{team}</Text>
  ) : (
    <Image
      source={{ uri: `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${team}.svg` }}
      style={s.mark}
      contentFit="contain"
      onError={() => setFailed(true)}
    />
  );
}
const s = StyleSheet.create({
  artwork: {
    width: '100%',
    aspectRatio: 320 / 180,
    backgroundColor: '#0b1115',
    overflow: 'hidden',
  },
  foreground: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: '8%',
    paddingVertical: '10%',
    gap: 4,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  primary: { fontFamily: 'BarlowCondensed', fontWeight: '800', flexShrink: 1 },
  secondary: {
    color: '#fff',
    fontFamily: 'BarlowCondensed',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detail: { fontSize: 12, color: '#cbd3d7' },
  mark: { width: '25%', height: 64 },
});
