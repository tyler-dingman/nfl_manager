import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  summarizePlayers,
  rankPlayers,
  playerStatus,
  type DirectoryPlayer,
} from '../../../src/components/parlay-lab/player-directory-data';
import { TEAM_LIST } from '../../../src/data/teams';
import { SectionMenu } from './section-menu';
import { authenticatedFetch } from '../lib/auth';
import type { ParlayMarket } from '../lib/parlay';
export function ParlayPlayers({
  markets,
  onOpen,
}: {
  markets: ParlayMarket[];
  onOpen: (market: ParlayMarket) => void;
}) {
  const [roster, setRoster] = useState<DirectoryPlayer[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('ALL');
  const [position, setPosition] = useState('ALL');
  const [limit, setLimit] = useState(25);
  useEffect(() => {
    const controller = new AbortController();
    void authenticatedFetch('/api/parlay-lab/players', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const body = await r.json();
        if (!controller.signal.aborted) setRoster(body.players ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Player profiles could not be loaded. Available research is shown below.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const players = useMemo(
    () => summarizePlayers(markets, roster).sort(rankPlayers),
    [markets, roster],
  );
  const filtered = players.filter(
    (p) =>
      (team === 'ALL' || p.teamAbbr === team) &&
      (position === 'ALL' || p.position === position) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <View>
      <Text style={s.heading}>PLAYER RESEARCH</Text>
      <Text style={s.copy}>Compare current props, recent performance, and Lab Scores.</Text>
      {loading && <ActivityIndicator color="white" />}
      {!!error && <Text style={s.copy}>{error}</Text>}
      <TextInput
        accessibilityLabel="Search player directory"
        placeholder="Search players"
        placeholderTextColor="#A8BAC4"
        value={query}
        onChangeText={setQuery}
        style={s.input}
      />
      <SectionMenu
        title={`Team: ${team}`}
        items={[
          { label: 'All teams', selected: team === 'ALL', onPress: () => setTeam('ALL') },
          ...TEAM_LIST.map((t) => ({
            label: t.name,
            selected: team === t.abbr,
            onPress: () => setTeam(t.abbr),
          })),
        ]}
      />
      <SectionMenu
        title={`Position: ${position}`}
        items={['ALL', ...new Set(players.map((p) => p.position))].map((value) => ({
          label: value,
          selected: position === value,
          onPress: () => setPosition(value),
        }))}
      />
      {filtered.slice(0, limit).map((p) => {
        const status = playerStatus(p);
        return (
          <Pressable key={p.id} style={s.card} onPress={() => onOpen(p.market)}>
            <View style={s.row}>
              {p.headshotUrl && <Image source={{ uri: p.headshotUrl }} style={s.image} />}
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.copy}>
                  {p.teamAbbr} · {p.position}
                </Text>
              </View>
              <Text style={s.score}>{p.score == null ? '—' : Math.round(p.score)}</Text>
            </View>
            {status && <Text style={s.name}>{status.label}</Text>}
            <Text style={s.copy}>
              {status?.text ?? `${p.games} games · ${p.observations} observations`}
            </Text>
            <Text style={s.copy}>
              Hit rate {p.hitRate == null ? '—' : `${Math.round(p.hitRate)}%`} · Recent{' '}
              {p.recentRate == null ? '—' : `${Math.round(p.recentRate)}%`}
            </Text>
            <Text style={s.name}>View research →</Text>
          </Pressable>
        );
      })}
      {!filtered.length && !loading && <Text style={s.copy}>No players match these filters.</Text>}
      {filtered.length > limit && (
        <Pressable style={s.card} onPress={() => setLimit((v) => v + 25)}>
          <Text style={s.name}>Show more players →</Text>
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontFamily: 'BarlowCondensed', fontSize: 30, color: 'white', marginVertical: 12 },
  copy: { fontSize: 13, lineHeight: 21, color: '#A8BAC4', marginVertical: 6 },
  name: { color: 'white', fontWeight: '800', fontSize: 15 },
  input: {
    color: 'white',
    borderWidth: 1,
    borderColor: '#34505F',
    borderRadius: 8,
    padding: 14,
    marginVertical: 12,
  },
  card: {
    backgroundColor: '#061D2B',
    borderWidth: 1,
    borderColor: '#183743',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  image: { width: 60, height: 65, resizeMode: 'contain' },
  score: { fontFamily: 'BarlowCondensed', fontSize: 30, color: '#FFB81C' },
});
