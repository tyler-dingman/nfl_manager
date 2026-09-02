import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { searchDD, type SearchData } from '../lib/api';
import { useTeam } from '../lib/team-context';
export default function Search() {
  const params = useLocalSearchParams<{ q?: string }>(),
    { teamId } = useTeam();
  const [query, setQuery] = useState(params.q ?? ''),
    [data, setData] = useState<SearchData>({ stories: [], players: [] }),
    [loading, setLoading] = useState(false),
    [searched, setSearched] = useState(false);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setData({ stories: [], players: [] });
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      void searchDD(normalized, teamId)
        .then(setData)
        .finally(() => {
          setLoading(false);
          setSearched(true);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, teamId]);
  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.body}>
        <Eyebrow>{teamId} SEARCH</Eyebrow>
        <Heading>Find what matters.</Heading>
        <View style={s.field}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Stories, players, sources…"
            placeholderTextColor="#8A969F"
            style={s.input}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Text style={s.clear}>CLEAR</Text>
            </Pressable>
          ) : null}
        </View>
        {loading ? (
          <ActivityIndicator color={C.red} style={s.loader} />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.results}>
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
            {searched && !data.stories.length && !data.players.length ? (
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
  page: { flex: 1, backgroundColor: C.cream },
  body: { flex: 1, padding: 20 },
  field: {
    height: 54,
    borderRadius: 15,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#D9D2C7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 20,
  },
  input: { flex: 1, color: C.ink, fontSize: 16 },
  clear: { color: C.red, fontSize: 13, fontWeight: '900' },
  loader: { marginTop: 40 },
  results: { paddingBottom: 40 },
  section: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 24,
    marginBottom: 9,
  },
  card: { backgroundColor: C.white, borderRadius: 15, padding: 16, marginBottom: 9 },
  meta: { color: C.red, fontSize: 13, fontWeight: '900' },
  title: { color: C.ink, fontSize: 17, fontWeight: '900', lineHeight: 21, marginTop: 6 },
  source: { color: C.muted, fontSize: 13, fontWeight: '800', marginTop: 8 },
  player: {
    backgroundColor: C.white,
    borderRadius: 15,
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
