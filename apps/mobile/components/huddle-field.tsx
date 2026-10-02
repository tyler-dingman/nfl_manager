import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, Text, Pressable } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import { latestVisualization, playGeometry } from '../../../packages/huddle/play-visualization';
import type { Game } from '../../../packages/huddle';
import { fieldArtwork } from '../../../packages/huddle/field-artwork';
import { fieldPoint, fieldUI, firstDownPosition } from '../../../packages/huddle/field-position';
import { getFrontOfficeTeamTheme } from '../../../src/lib/team-theme-tokens';
import { teamLogoAssets } from '../lib/team-logo-assets';
import { nativeFieldBase, nativeEndZones } from '../lib/huddle-field-assets';
import { FIELD_WIDTH, FIELD_HEIGHT } from '../../../packages/huddle/field-assets';

export function HuddleField({ game }: { game: Game }) {
  const play = latestVisualization(game);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(1);
  const geometry = play ? playGeometry(play, progress) : null;
  const originX = play ? fieldPoint(play.startYardLine).x : 0;
  const endX = geometry?.destination.x ?? originX;
  const revealWidth = (Math.abs(endX - originX) + 60) * Math.min(1, progress / 0.65);
  const revealX = endX >= originX ? originX - 30 : originX + 30 - revealWidth;
  const [width, setWidth] = useState(360);
  const position = game.ball ?? 50,
    target = firstDownPosition(game);
  const motion = useRef(new Animated.Value(1)).current;
  const playId = game.plays.at(-1)?.id;
  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    const listener = motion.addListener(({ value }) => setProgress(value));
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      motion.setValue(reduced ? 1 : 0);
      if (!reduced)
        Animated.timing(motion, { toValue: 1, duration: 750, useNativeDriver: false }).start();
    });
    return () => {
      cancelled = true;
      motion.stopAnimation();
      motion.removeListener(listener);
    };
  }, [playId, motion]);
  if (game.ball === null)
    return <Text style={{ color: 'white' }}>Field position unavailable.</Text>;
  const canvasWidth = Math.max(width, 800),
    scale = canvasWidth / FIELD_WIDTH,
    height = FIELD_HEIGHT * scale;
  const { point, badge, logo } = fieldUI(position, game.direction);
  const offset = Math.max(width - canvasWidth, Math.min(0, width / 2 - point.x * scale));
  const accent = getFrontOfficeTeamTheme(game.possession ?? game.away).accent;
  const layers = [
    nativeFieldBase,
    nativeEndZones[game.away]?.left,
    nativeEndZones[game.home]?.right,
  ].filter(Boolean);
  return (
    <View
      testID={`field-position-${position}`}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={`${game.away} left end zone, ${game.home} right end zone. ${game.possession} ball at ${game.location}, ${game.down}. Moving ${game.direction === 1 ? 'right' : 'left'}.`}
      style={{
        width: '100%',
        height,
        overflow: 'hidden',
        borderRadius: 10,
        backgroundColor: '#04151c',
      }}
    >
      <View style={{ width: canvasWidth, height, position: 'absolute', left: offset }}>
        {layers.map((source, index) => (
          <Image
            key={index}
            testID={`field-image-${index}`}
            source={source}
            contentFit="contain"
            contentPosition="center"
            transition={0}
            style={{ position: 'absolute', left: 0, top: 0, width: canvasWidth, height }}
          />
        ))}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: canvasWidth, height }}
        >
          <SvgXml
            xml={fieldArtwork(game, accent, position, target, !play)}
            width={canvasWidth}
            height={height}
          />
        </View>
        {game.possession && (
          <Image
            source={teamLogoAssets[game.possession]}
            contentFit="contain"
            style={{
              position: 'absolute',
              left: logo.x * scale,
              top: logo.y * scale,
              width: logo.width * scale,
              height: logo.height * scale,
            }}
          />
        )}
        {geometry && (
          <>
            <SvgXml
              pointerEvents="none"
              width={canvasWidth}
              height={height}
              style={{ position: 'absolute' }}
              xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="none" stroke="#d8e9e9" stroke-width="1.3"/></marker><clipPath id="reveal"><rect x="${revealX}" y="0" width="${revealWidth}" height="${FIELD_HEIGHT}"/></clipPath></defs><path d="${geometry.path}" clip-path="url(#reveal)" fill="none" stroke="#d8e9e9" stroke-width="3" stroke-dasharray="9 7" marker-end="url(#arrow)"/></svg>`}
            />
            {geometry.markers.map(({ player, point, reveal }) => (
              <Pressable
                key={player.id}
                accessibilityLabel={`${player.name}, ${player.position}, ${player.team}`}
                onPress={() => setSelected(selected === player.id ? null : player.id)}
                style={{
                  opacity: progress >= reveal ? 1 : 0,
                  position: 'absolute',
                  left: point.x * scale - 14,
                  top: point.y * scale - 14,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: '#d8e9e9',
                  backgroundColor: '#254b55',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {player.headshotUrl && !failed[player.id] ? (
                  <Image
                    source={{ uri: player.headshotUrl }}
                    onError={() => setFailed((v) => ({ ...v, [player.id]: true }))}
                    style={{ width: 25, height: 25, borderRadius: 13 }}
                  />
                ) : (
                  <Text style={{ color: 'white', fontSize: 10 }}>
                    {player.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </Text>
                )}
                {selected === player.id && (
                  <Text
                    style={{
                      position: 'absolute',
                      bottom: 32,
                      width: 140,
                      backgroundColor: '#04151c',
                      color: 'white',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {player.name}
                    {'\n'}
                    {player.position} · {player.team}
                  </Text>
                )}
              </Pressable>
            ))}
            {!!geometry.indicator && (
              <Text
                style={{
                  position: 'absolute',
                  left: geometry.destination.x * scale + 16,
                  top: geometry.destination.y * scale - 24,
                  color: 'white',
                  backgroundColor: '#163b43',
                  fontSize: 11,
                }}
              >
                {geometry.indicator}
              </Text>
            )}
          </>
        )}
        <View
          style={{
            position: 'absolute',
            left: (badge.x - badge.width / 2) * scale,
            top: badge.y * scale,
            width: badge.width * scale,
            height: badge.height * scale,
            backgroundColor: accent,
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: Math.max(10, 22 * scale) }}>
            {game.down}
          </Text>
        </View>
      </View>
    </View>
  );
}
