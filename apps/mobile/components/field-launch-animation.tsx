import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LOGO_PATHS } from '../../../src/lib/branding/team-logo-paths';
import { LAUNCH_LOGO } from '../lib/launch/logo-pieces';
const AP = Animated.createAnimatedComponent(Path);
const AR = Animated.createAnimatedComponent(Rect);
const NAVY = '#001016',
  TAN = '#F4D9B7',
  RED = '#FF3D38',
  INK = '#00172B';
type Piece = { d: string; x: number; y: number; width: number; height: number };
function phase(t: number, start: number, duration: number) {
  'worklet';
  return Math.max(0, Math.min(1, (t - start) / duration));
}
function ease(p: number) {
  'worklet';
  return p * p * (3 - 2 * p);
}

// One shared strip coordinate keeps all nine labels locked to their yard marks.
function fieldTravel(t: number) {
  'worklet';
  if (t <= 1400) {
    const p = t / 1400;
    return 80 * (0.95 * p + 0.05 * p * p);
  }
  const p = phase(t, 1440, 340);
  return 80 + 0.12 * (Math.min(t - 1400, 40) +
    340 * (p - p ** 3 + p ** 4 / 2));
}

// Field marks occur every yard, with a tall mark every five yards and a
// number every ten. Canonical badge marks survive the morph; extra field
// marks fade as the strip compresses to the badge's original spacing.
const FIELD_SLOTS = 35;
const EXTRA_FIELD_SLOTS = [2, 4, 7, 9, 12, 14, 17, 19, 22, 24, 27, 29, 32, 33, 34];
// Each canonical badge mark is the SAME mounted vector throughout the field and logo.
function Hash({
  piece,
  index,
  time,
  width,
  badgeWidth,
  fieldSlot,
}: {
  piece: Piece;
  index: number;
  time: SharedValue<number>;
  width: number;
  badgeWidth: number;
  fieldSlot?: number;
}) {
  const fieldIndex = fieldSlot ?? Math.floor(index / 3) * 5 + (index % 3 === 2 ? 3 : index % 3);
  const scale = badgeWidth / 1594,
    spacing = width / 16,
    span = spacing * FIELD_SLOTS;
  const finalX = (width - badgeWidth) / 2 + piece.x * scale,
    finalY = (piece.y - 403) * scale;
  const style = useAnimatedStyle(() => {
    const t = time.value,
      p = ease(phase(t, 1440, 340));
    const travel = fieldTravel(t) * spacing;
    // Stop recycling offscreen marks during compression, avoiding wrap jumps.
    const anchor = fieldTravel(Math.min(t, 1440)) * spacing;
    const x = ((((fieldIndex * spacing - anchor + span / 2) % span) + span) % span)
      - span / 2 + width / 2 - (travel - anchor);
    return {
      opacity: fieldSlot === undefined ? 1 : 1 - p,
      transform: [
        { translateX: (x - (piece.width * scale) / 2) * (1 - p) + finalX * p },
        { translateY: finalY },
        { scaleY: 1 + 0.25 * (1 - p) },
      ],
    };
  });
  return (
    <Animated.View
      testID={fieldSlot === undefined ? `field-badge-hash-${index}` : `field-extra-hash-${fieldSlot}`}
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: piece.width * scale,
          height: piece.height * scale,
        },
        style,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${piece.x} ${piece.y} ${piece.width} ${piece.height}`}
      >
        <Path d={piece.d} fill={RED} />
      </Svg>
    </Animated.View>
  );
}
function Yard({
  number,
  index,
  time,
  width,
  baseline,
}: {
  number: number;
  baseline: number;
  index: number;
  time: SharedValue<number>;
  width: number;
}) {
  const spacing = width / 16;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - phase(time.value, 1490, 100),
    transform: [
      { translateX: width / 2 + index * spacing * 10 - fieldTravel(time.value) * spacing - 45 },
      { scale: number === 50 ? 1 + 0.05 * Math.max(0, 1 - Math.abs(fieldTravel(time.value) - 40) / 2) : 1 },
    ],
  }));
  return (
    <Animated.View
      testID={`field-yard-${index}`}
      style={[{ position: 'absolute', top: baseline - 74, left: 0, width: 90 }, style]}
    >
      <Text style={styles.yard}>{number}</Text>
    </Animated.View>
  );
}
function Letter({
  piece,
  index,
  time,
  size,
}: {
  piece: Piece;
  index: number;
  time: SharedValue<number>;
  size: number;
}) {
  const start = index < 4 ? 1610 + index * 20 : 1660 + (index - 4) * 12;
  const style = useAnimatedStyle(() => {
    const p = phase(time.value, start, 50);
    return { opacity: p, transform: [{ translateY: 8 * (1 - ease(p)) }] };
  });
  const counters = LAUNCH_LOGO.counters.filter(
    (c) =>
      c.x + c.width / 2 >= piece.x &&
      c.x + c.width / 2 <= piece.x + piece.width &&
      c.y >= piece.y &&
      c.y < piece.y + piece.height,
  );
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={(size * 806) / 1594} viewBox="0 0 1594 806">
        <Path d={piece.d} fill="#FFFFFF" />
        {counters.map((c, i) => (
          <Path key={i} d={c.d} fill={INK} />
        ))}
      </Svg>
    </Animated.View>
  );
}
function BadgeBuild({ time, size }: { time: SharedValue<number>; size: number }) {
  const border = useAnimatedProps(() => ({
    strokeDashoffset: 6000 * (1 - phase(time.value, 1605, 190)),
  }));
  const background = useAnimatedStyle(() => ({ opacity: phase(time.value, 1605, 70) }));
  const block = useAnimatedStyle(() => ({ opacity: phase(time.value, 1640, 65) }));
  const amp = useAnimatedProps(() => ({ width: 494 * phase(time.value, 1650, 110) }));
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: (size * 806) / 1594,
        left: '50%',
        marginLeft: -size / 2,
        top: (-size * 403) / 1594,
      }}
    >
      <Svg
        width={size}
        height={(size * 806) / 1594}
        viewBox="0 0 1594 806"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Mask id="launch-border">
            <AP
              d={LOGO_PATHS[0].d}
              stroke="white"
              strokeWidth={90}
              fill="none"
              strokeDasharray="6000 6000"
              animatedProps={border}
            />
          </Mask>
        </Defs>
        <Path d={LOGO_PATHS[0].d} fill={TAN} mask="url(#launch-border)" />
        <Path d={LOGO_PATHS[1].d} fill={NAVY} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, background]}>
        <Svg width={size} height={(size * 806) / 1594} viewBox="0 0 1594 806">
          <Path d={LOGO_PATHS[1].d} fill={INK} />
        </Svg>
      </Animated.View>
      {LAUNCH_LOGO.letters.map((piece, index) => (
        <Letter key={index} {...{ piece, index, time, size }} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, block]}>
        <Svg width={size} height={(size * 806) / 1594} viewBox="0 0 1594 806">
          {LAUNCH_LOGO.badge.map((p, i) => (
            <Path key={i} d={p.d} fill={RED} />
          ))}
        </Svg>
      </Animated.View>
      <Svg
        width={size}
        height={(size * 806) / 1594}
        viewBox="0 0 1594 806"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Mask id="launch-amp">
            <AR x={1100} y={0} height={600} fill="white" animatedProps={amp} />
          </Mask>
        </Defs>
        {LAUNCH_LOGO.ampersand.map((p, i) => (
          <Path key={i} d={p.d} fill={INK} mask="url(#launch-amp)" />
        ))}
        {LAUNCH_LOGO.ampersandCounter.map((p, i) => (
          <Path key={i} d={p.d} fill={RED} mask="url(#launch-amp)" />
        ))}
      </Svg>
    </View>
  );
}
export function FieldLaunchAnimation({
  onDone,
  short = false,
  reduced = false,
}: {
  onDone: () => void;
  short?: boolean;
  reduced?: boolean;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.76, 310);
  const clock = useSharedValue(0);
  // Full run: 2.8s traversal + 850ms assembly + 1.5s completed hold + 250ms fade.
  const timelineDuration = reduced ? 1750 : short ? 2600 : 5400;
  const duration = timelineDuration;
  const done = useRef(false),
    callback = useRef(onDone);
  callback.current = onDone;
  const finish = () => {
    if (!done.current) {
      done.current = true;
      callback.current();
    }
  };
  const time = useDerivedValue(() =>
    reduced ? 1825 + clock.value / 2
      : short ? 1400 + clock.value / 2
        : clock.value <= 2800 ? clock.value * 1400 / 2800 : 1400 + (clock.value - 2800) / 2,
  );
  useEffect(() => {
    clock.value = withTiming(timelineDuration, { duration, easing: Easing.linear });
    const timer = setTimeout(finish, duration + 30);
    let interrupted = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') interrupted = true;
      else if (interrupted) finish();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
      cancelAnimation(clock);
    };
  }, [duration, timelineDuration, clock]);
  const screen = useAnimatedStyle(() => ({
    opacity: (reduced ? phase(clock.value, 0, 150) : 1) * (1 - phase(time.value, 2575, 125)),
  }));
  const assembly = useAnimatedStyle(() => {
    const scale = reduced ? 1 : 1 - 0.02 * ease(phase(time.value, 1440, 340))
      + 0.02 * ease(phase(time.value, 1795, 30));
    const baseline = ((680 - 403) * size) / 1594;
    return { transform: [{ translateY: (baseline - 0.5) * (1 - scale) }, { scale }] };
  });
  const line = useAnimatedStyle(() => ({
    opacity: 1 - phase(time.value, 1460, 180),
    // Open a gap at the center and retract both halves toward the edges.
    width: width * (1 - ease(phase(time.value, 1460, 180))),
  }));
  return (
    <Animated.View
      testID={short ? 'field-launch-short' : 'field-launch-full'}
      style={[styles.page, screen]}
      accessibilityLabel="Down & Distance launch animation"
    >
      <View pointerEvents="none" style={styles.stripe} />
      <Animated.View style={[{ width, height: 1 }, assembly]}>
        <BadgeBuild time={time} size={size} />
        {!reduced && (['left', 'right'] as const).map((side) => (
          <Animated.View key={side} style={[{
            position: 'absolute', [side]: -width / 2,
            height: 1, top: ((680 - 403) * size) / 1594,
            backgroundColor: RED,
          }, line]} />
        ))}

        {LAUNCH_LOGO.ticks.map((piece, index) => (
          <Hash key={index} {...{ piece, index, time, width, badgeWidth: size }} />
        ))}
        {!reduced && EXTRA_FIELD_SLOTS.map((fieldSlot) => (
          <Hash key={`extra-${fieldSlot}`} piece={LAUNCH_LOGO.ticks[1]} index={1}
            {...{ fieldSlot, time, width, badgeWidth: size }} />
        ))}
        {!short &&
          !reduced &&
          [10, 20, 30, 40, 50, 40, 30, 20, 10].map((number, index) => (
            <Yard
              key={index}
              baseline={((680 - 403) * size) / 1594}
              {...{ number, index, time, width }}
            />
          ))}
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip introduction"
        onPress={finish}
        style={styles.skip}
      >
        <Text style={{ color: TAN, fontSize: 12 }}>Skip</Text>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NAVY, justifyContent: 'center', overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    right: 40,
    top: '20%',
    width: 34,
    height: '90%',
    backgroundColor: RED,
    opacity: 0.035,
    transform: [{ rotate: '28deg' }],
  },
  yard: {
    color: '#FFFFFF',
    fontFamily: 'BarlowCondensedItalic',
    fontSize: 52,
    textAlign: 'center',
  },
  skip: { position: 'absolute', right: 20, top: 12, padding: 14 },
});
