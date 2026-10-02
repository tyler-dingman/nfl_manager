import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { TEAM_LIST } from '../../../src/data/teams';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C } from '../components/screen';
import { searchDD, type SearchData } from '../lib/api';
import { useTeam } from '../lib/team-context';
import { authenticatedFetch } from '../lib/auth';
import { AI_QUICK_PROMPTS } from '../../../packages/search/suggestions';
import type { SearchResponse } from '../../../src/features/search/types';
import { API_BASE_URL } from '../lib/network';
export default function Search() {
  const params = useLocalSearchParams<{ q?: string; ask?: string }>(),
    { teamId } = useTeam();
  const team = TEAM_LIST.find(t => t.abbr === teamId);
  const nickname = team ? team.name.replace(`${team.city} `, '') : 'your team';
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  const [query, setQuery] = useState(params.q ?? ''),
    [data, setData] = useState<SearchData>({ stories: [], players: [] }),
    [loading, setLoading] = useState(false),
    [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<{ team: string; questions: string[] }>({
    team: '',
    questions: [],
  });
  const [answer, setAnswer] = useState<SearchResponse | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [searchError, setSearchError] = useState('');
  const aiRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    aiRequest.current?.abort();
    setAnswer(null);
    setAiBusy(false);
    setAiError('');
    void authenticatedFetch(`/api/search/suggestions?team=${encodeURIComponent(teamId)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((body) => {
        if (!controller.signal.aborted)
          setSuggestions({ team: teamId, questions: body.suggestions ?? [] });
      })
      .catch(() => {});
    return () => {
      controller.abort();
      aiRequest.current?.abort();
    };
  }, [teamId]);
  const runAI = async (question: string) => {
    if (question.trim().length < 2) return;
    aiRequest.current?.abort();
    const controller = new AbortController();
    aiRequest.current = controller;
    setQuery(question);
    setAiBusy(true);
    setAiError('');
    setAnswer(null);
    try {
      const result = await authenticatedFetch('/api/search', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: question,
          teamId,
          includeAnswer: true,
          limit: 12,
          context: answer?.context,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error ?? 'Search is temporarily unavailable.');
      if (!controller.signal.aborted) setAnswer(body);
    } catch (e) {
      if (!controller.signal.aborted)
        setAiError(e instanceof Error ? e.message : 'Search unavailable.');
    } finally {
      if (!controller.signal.aborted) setAiBusy(false);
    }
  };
  useEffect(() => {
    if (params.ask === '1' && params.q?.trim()) void runAI(params.q);
    // A submitted homepage question starts one request on entry (or team change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ask, params.q, teamId]);
  const questions = suggestions.team === teamId ? suggestions.questions : [];
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setData({ stories: [], players: [] });
      setSearched(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setSearchError('');
      void searchDD(normalized, teamId)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch(() => {
          if (!cancelled) {
            setData({ stories: [], players: [] });
            setSearchError('Search is unavailable. Please try again.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            setSearched(true);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, teamId]);
  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlurView pointerEvents="none" intensity={25} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss search" onPress={close} style={StyleSheet.absoluteFill} />
      <View style={s.body} accessibilityViewIsModal>
        <View style={s.field}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" />
          <TextInput
            accessibilityLabel="Search Down & Distance"
            maxLength={300}
            autoFocus
            value={query}
            onChangeText={(text) => {
              aiRequest.current?.abort();
              setAiBusy(false);
              setAnswer(null);
              setAiError('');
              setQuery(text);
            }}
            onSubmitEditing={() => void runAI(query)}
            placeholder={`Search or ask about ${nickname} football…`}
            placeholderTextColor="#94a3b8"
            style={s.input}
            returnKeyType="search"
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Submit search" disabled={query.trim().length < 2 || aiBusy} onPress={() => void runAI(query)} style={[s.iconButton, { opacity: query.trim().length < 2 || aiBusy ? 0.4 : 1 }]}>
            <Ionicons name="arrow-forward" size={20} color="#334155" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={close} style={[s.iconButton, { backgroundColor: '#f1f5f9' }]}>
            <Ionicons name="close" size={16} color="#64748b" />
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={C.red} style={s.loader} />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={{ flexShrink: 1 }}
            contentContainerStyle={s.results}
          >
            {!query.trim() && (
              <>
                <Text style={s.section}>ASK AI SEARCH</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {AI_QUICK_PROMPTS.map((prompt) => (
                    <Pressable key={prompt} style={s.prompt} onPress={() => void runAI(prompt)}>
                      <Text style={s.promptText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
                {questions.length > 0 && (
                  <>
                    <Text style={[s.section, { marginTop: 16 }]}>SUGGESTED</Text>
                    {questions.map((question) => (
                      <Pressable
                        key={question}
                        style={s.suggestion}
                        onPress={() => void runAI(question)}
                      >
                        <Text style={s.question}>{question}</Text>
                        <Ionicons name="arrow-forward" size={16} color="#334155" />
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}
            {aiBusy && <ActivityIndicator color={C.red} />}
            {searchError ? (
              <Text accessibilityRole="alert" style={s.source}>
                {searchError}
              </Text>
            ) : null}
            {aiError ? <Text accessibilityRole="alert">{aiError}</Text> : null}
            {answer && (
              <View style={s.card}>
                <Text style={s.section}>DOWN & DISTANCE ANSWER</Text>
                <Text style={s.title}>{answer.answer}</Text>
                {answer.blocks?.map((block, i) => {
                  const text =
                    block.type === 'paragraph'
                      ? block.text
                      : block.type === 'bulletList'
                        ? `${block.title}\n${block.items.map((t) => `• ${t}`).join('\n')}`
                        : 'rows' in block
                          ? `${block.title}\n${block.columns.join(' · ')}\n${block.rows.map((r) => r.join(' · ')).join('\n')}`
                          : 'games' in block
                            ? block.games
                                .map(
                                  (g) =>
                                    `${g.away} at ${g.home} · ${new Date(g.startsAt).toLocaleString()}`,
                                )
                                .join('\n')
                            : 'game' in block
                              ? `${block.game.away} at ${block.game.home} · ${new Date(block.game.startsAt).toLocaleString()}`
                              : '';
                  return (
                    <Text key={i} style={s.source}>
                      {text}
                    </Text>
                  );
                })}
                {answer.sources?.map((source) => (
                  <Pressable
                    key={source.id}
                    style={s.suggestion}
                    onPress={() =>
                      void Linking.openURL(
                        source.url.startsWith('/') ? `${API_BASE_URL}${source.url}` : source.url,
                      )
                    }
                  >
                    <Text style={s.source}>{source.title} ↗</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {data.stories.length ? (
              <>
                <Text style={s.section}>STORIES</Text>
                {data.stories.map((item) => (
                  <Pressable
                    key={item.id}
                    style={s.card}
                    onPress={() =>
                      router.push({
                        pathname: '/story/[id]',
                        params: { id: item.id, payload: JSON.stringify(item.story) },
                      })
                    }
                  >
                    <Text style={s.meta}>
                      {item.status} · {new Date(item.updatedAt).toLocaleDateString()}
                    </Text>
                    <Text style={s.title}>{item.headline}</Text>
                    {item.source ? <Text style={s.source}>{item.source} →</Text> : null}
                  </Pressable>
                ))}
              </>
            ) : null}
            {data.players.length ? (
              <>
                <Text style={s.section}>PLAYERS</Text>
                {data.players.map((player) => (
                  <Pressable
                    key={player.id}
                    style={s.player}
                    onPress={() =>
                      router.push({
                        pathname: '/player/[playerId]',
                        params: { playerId: player.id },
                      })
                    }
                  >
                    {player.headshotUrl ? (
                      <Image source={{ uri: player.headshotUrl }} style={s.avatar} />
                    ) : (
                      <View style={s.avatar} />
                    )}
                    <View>
                      <Text style={s.playerName}>{player.name}</Text>
                      <Text style={s.playerMeta}>
                        {player.teamAbbr} · {player.position}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}
            {searched &&
            !searchError &&
            !aiBusy &&
            !answer &&
            !data.stories.length &&
            !data.players.length ? (
              <View style={s.empty}>
                <Text style={s.title}>No results for “{query}”</Text>
                <Text style={s.emptyCopy}>Try a player surname or a broader football topic.</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  prompt: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    paddingHorizontal: 12,
  },
  promptText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  suggestion: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  question: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#334155' },
  page: { flex: 1, backgroundColor: 'transparent', padding: 16 },
  searchTitle: { fontSize: 18, fontWeight: '800', color: '#00172B' },
  body: { maxHeight: '90%', width: '100%', maxWidth: 672, alignSelf: 'center', backgroundColor: 'white', borderRadius: 24, overflow: 'hidden' },
  field: {
    minHeight: 64,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: { outlineWidth: 0, flex: 1, minWidth: 0, color: '#020617', fontSize: 16, fontWeight: '600', height: 64 },
  clear: { color: C.red, fontSize: 13, fontWeight: '900' },
  loader: { marginTop: 40 },
  results: { padding: 24, paddingTop: 16 },
  section: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: 4,
    marginBottom: 9,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  meta: { color: C.red, fontSize: 13, fontWeight: '900' },
  title: { color: C.ink, fontSize: 17, fontWeight: '900', lineHeight: 21, marginTop: 6 },
  source: { color: C.muted, fontSize: 13, fontWeight: '800', marginTop: 8 },
  player: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D9DDE0', marginRight: 12 },
  playerName: { color: C.ink, fontWeight: '900', fontSize: 16 },
  playerMeta: { color: C.muted, marginTop: 3 },
  empty: { backgroundColor: C.white, borderRadius: 16, padding: 20, marginTop: 24 },
  emptyCopy: { color: C.muted, marginTop: 7 },
});
