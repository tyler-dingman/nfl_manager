import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Keyboard, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authenticatedFetch } from '../lib/auth';
import type { SearchResponse } from '../../../src/features/search/types';
import { SearchAnswer } from './search-answer';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AI_QUICK_PROMPTS } from '../../../packages/search/suggestions';
import { TEAM_LIST } from '../../../src/data/teams';
import { lightenHexColor } from '../../../src/lib/color-utils';
import { useTeamBranding } from '../lib/team-branding';

export function HomeAiSearch() {
  const { teamId, theme } = useTeamBranding();
  const team = TEAM_LIST.find((item) => item.abbr === teamId);
  const [query, setQuery] = useState('');
  const input = useRef<TextInput>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    request.current?.abort(); setResponse(null); setBusy(false); setError('');
    return () => request.current?.abort();
  }, [teamId]);
  const search = async (text: string) => {
    if (text.trim().length < 2) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const context = response?.context;
    setQuery(text); setBusy(true); setError(''); setResponse(null); Keyboard.dismiss();
    reveal.setValue(0);
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!controller.signal.aborted) Animated.timing(reveal, { toValue: 1, duration: reduced ? 0 : 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    try {
      const result = await authenticatedFetch('/api/search', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text.trim(), teamId, includeAnswer: true, limit: 12, context, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error ?? 'Search is temporarily unavailable.');
      if (!controller.signal.aborted) setResponse(body);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search unavailable.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return (
    <View testID="home-ai-search" style={s.panel}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="searchGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.primary} />
            <Stop offset="1" stopColor={lightenHexColor(theme.primary, 0.2)} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#searchGradient)" />
      </Svg>
      <Text style={s.title}>
        Ask anything about{' '}
        <Text style={{ color: theme.secondary }}>{team?.name ?? teamId} football</Text>
      </Text>
      <View style={s.field}>
        <Ionicons name="sparkles-outline" size={25} color={theme.primary} />
        <TextInput
          ref={input}
          accessibilityLabel="Ask anything"
          placeholder="Ask anything…"
          placeholderTextColor="#64748B"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          returnKeyType="search"
          style={s.input}
        />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear AI search" onPress={() => { request.current?.abort(); setQuery(''); setResponse(null); setBusy(false); setError(''); }} style={{ padding: 6 }}><Ionicons name="close" size={18} color="#64748b" /></Pressable>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voice input help"
          style={s.button}
          onPress={() => {
            input.current?.focus();
            Alert.alert(
              'Voice input',
              'Use the microphone on your device keyboard to dictate your question, then tap Search.',
            );
          }}
        >
          <Ionicons name="mic-outline" size={22} color="#00172B" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask AI"
          style={s.button}
          onPress={() => search(query)}
        >
          <Ionicons name="search-outline" size={25} color="#00172B" />
        </Pressable>
      </View>
      {(busy || response || error) && <Animated.View testID="home-ai-answer" style={[s.answer, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        {busy ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><ActivityIndicator color={theme.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', fontSize: 14, color: '#00172b' }}>Searching Down &amp; Distance</Text><Text style={{ color: '#52677c', fontSize: 14, marginTop: 4 }}>Checking verified team data and relevant reporting…</Text></View></View> : error ? <Text accessibilityRole="alert" style={{ color: '#b91c1c', lineHeight: 22 }}>{error} Try your search again.</Text> : response ? <SearchAnswer response={response} accent={theme.primary} /> : null}
      </Animated.View>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.prompts}
      >
        <Text style={s.try}>Try:</Text>
        {AI_QUICK_PROMPTS.map((prompt, i) => (
          <Pressable
            key={prompt}
            accessibilityLabel={prompt}
            accessibilityRole="button"
            onPress={() => search(prompt)}
            style={s.chip}
          >
            <Ionicons
              name={i === 0 ? 'document-text-outline' : i === 1 ? 'mic-outline' : 'people-outline'}
              size={20}
              color={theme.secondary}
            />
            <Text style={s.chipText}>{prompt}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  answer: { marginTop: 16, borderRadius: 16, backgroundColor: '#fffffff2', paddingHorizontal: 20, paddingVertical: 16 },
  panel: { borderRadius: 16, overflow: 'hidden', padding: 20, marginTop: 12, marginBottom: 32 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '900', color: 'white', marginBottom: 24 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 40,
    paddingLeft: 14,
    minHeight: 60,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    color: '#00172B',
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    height: 40,
  },
  button: { width: 40, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  prompts: { alignItems: 'center', gap: 12, paddingTop: 24 },
  try: { fontSize: 18, fontWeight: '900', color: 'white' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chipText: { fontSize: 14, fontWeight: '700', color: '#00172B' },
});
