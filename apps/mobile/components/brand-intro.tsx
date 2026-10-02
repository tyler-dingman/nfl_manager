import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { TeamBrandedLogo } from './team-branded-logo';
import { DEFAULT_TEAM_BRAND_THEME as brand } from '../../../src/lib/team-brand-themes';

function Orbit({ size, index, reduced }: { size: number; index: number; reduced: boolean }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 14000 + index * 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [reduced, index, turn]);
  return <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
    <Svg width={size} height={size} viewBox="0 0 300 300"><Circle cx={150} cy={150} r={142} stroke={brand.primary} strokeWidth={1.5} strokeDasharray="1 9" opacity={0.3 + index * 0.15} fill="none" />
      {[0, 1, 2, 3, 4, 5].map(n => { const angle = n * Math.PI / 3 + index; return <Circle key={n} cx={150 + 142 * Math.cos(angle)} cy={150 + 142 * Math.sin(angle)} r={n % 3 === 0 ? 6 : 2.5} fill={n % 2 ? brand.light : brand.primary} />; })}
    </Svg>
  </Animated.View>;
}
export function BrandIntro({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const [reduced, setReduced] = useState(true);
  const logoFade = useRef(new Animated.Value(0)).current;
  const ringsFade = useRef(new Animated.Value(0)).current;
  const messageFade = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;
  const exiting = useRef(false);
  const finish = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    Animated.timing(screenFade, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onDone(); });
  }, [onDone, screenFade]);
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 380);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);
  useEffect(() => {
    const fade = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    const animation = Animated.sequence([
      fade(logoFade, 1, 700),
      Animated.delay(350),
      fade(ringsFade, 1, 900),
      Animated.delay(650),
      fade(logoFade, 0, 450),
      fade(messageFade, 1, 850),
      Animated.delay(1500),
    ]);
    animation.start(({ finished }) => { if (finished) finish(); });
    const orbitTimer = setTimeout(() => setStage(1), 1050);
    const messageTimer = setTimeout(() => setStage(2), 3050);
    return () => { animation.stop(); clearTimeout(orbitTimer); clearTimeout(messageTimer); screenFade.stopAnimation(); };
  }, [logoFade, ringsFade, messageFade, screenFade, finish]);
  return <Animated.View style={[s.page, { opacity: screenFade }]} testID={`brand-intro-${stage}`}>
    <Animated.Image source={require('../../../public/images/gameday/stadium/kc/kc_empty.png')} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: ringsFade.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0] }) }]} resizeMode="cover" />
    <Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" style={s.skip} onPress={finish}><Text style={s.small}>Skip</Text></Pressable>
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: ringsFade }}>
        {[0, 1, 2].map(i => <Orbit key={i} size={size - i * 34} index={i} reduced={reduced} />)}
      </Animated.View>
      <Animated.View style={{ position: 'absolute', opacity: logoFade }}>
        <TeamBrandedLogo letteringColor="#FFFFFF" style={{ width: size * 0.58, height: size * 0.32 }} />
      </Animated.View>
      <Animated.View style={{ opacity: messageFade }}>
        <Text style={s.message}>MORE{'\n'}FOOTBALL{'\n'}<Text style={{ color: brand.primary }}>TOGETHER.</Text></Text>
      </Animated.View>
    </View>
    {stage < 2 ? <Text style={[s.small, { letterSpacing: 3, marginTop: 32 }]}>FOOTBALL LIVES HERE.</Text> : <Pressable accessibilityRole="button" accessibilityLabel="Continue to welcome" onPress={finish} style={{ flexDirection: 'row', gap: 10, padding: 24 }}>{[0,1,2].map(i => <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === 0 ? brand.primary : '#29383e' }} />)}</Pressable>}
  </Animated.View>;
}
const s = StyleSheet.create({ page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#001016' }, skip: { position: 'absolute', top: 12, right: 20, padding: 12 }, small: { color: brand.light, fontSize: 11 }, message: { color: brand.light, textAlign: 'center', fontFamily: 'BarlowCondensed', fontSize: 36, lineHeight: 38 } });
