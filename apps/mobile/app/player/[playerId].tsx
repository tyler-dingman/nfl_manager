import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../../components/screen';
import { getPlayer, type PlayerDetail } from '../../lib/api';
const money = (value: number | null | undefined) =>
  value == null ? '—' : `$${(value / 1_000_000).toFixed(1)}M`;
export default function Player() {
  const [tab, setTab] = useState('Overview');
  const { playerId } = useLocalSearchParams<{ playerId: string }>(),
    [data, setData] = useState<PlayerDetail | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (playerId)
      getPlayer(playerId)
        .then(setData)
        .catch(() => setError('Player information is unavailable.'));
  }, [playerId]);
  if (error)
    return (
      <View style={s.center}>
        <Heading>Player unavailable</Heading>
        <Text style={s.error}>{error}</Text>
      </View>
    );
  if (!data)
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.red} />
      </View>
    );
  const { player, contract } = data;
  const names = player.name.split(' ');
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <View style={s.hero}>
        {player.headshotUrl ? (
          <Image source={{ uri: player.headshotUrl }} style={s.image} />
        ) : (
          <View style={s.image}>
            <Text style={s.initials}>{names.map((n) => n[0]).join('')}</Text>
          </View>
        )}
        <View style={s.heroCopy}>
          <Text style={s.team}>
            {player.teamAbbr} · {player.position}
          </Text>
          <Text style={s.firstName}>{names.slice(0, -1).join(' ')}</Text>
          <Text style={s.lastName}>{names.at(-1)}</Text>
          <Text style={s.bio}>
            {[
              player.age && `Age ${player.age}`,
              player.height,
              player.weight && `${player.weight} lbs`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs}>
        {['Overview', 'Stats', 'Contract', 'News'].map((value) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            key={value}
            onPress={() => setTab(value)}
            style={[s.tab, tab === value && s.activeTab]}
          >
            <Text style={s.tabText}>{value}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.content}>
        {(tab === 'Overview' || tab === 'Contract') && (
          <>
            <Text style={s.section}>CONTRACT OVERVIEW</Text>
            <View style={s.contract}>
              <Fact label="STATUS" value={contract?.contractStatus ?? 'Active'} />
              <Fact label="CAP HIT" value={money(contract?.capHit)} />
              <Fact label="YEARS" value={contract?.years?.toString() ?? '—'} />
              <Fact label="GUARANTEED" value={money(contract?.guaranteed)} />
            </View>
          </>
        )}
        {(tab === 'Overview' || tab === 'Stats') &&
          (Object.keys(player.stats ?? {}).length ? (
            <>
              <Text style={s.section}>AVAILABLE STATS</Text>
              <View style={s.stats}>
                {Object.entries(player.stats).map(([key, value]) => (
                  <Fact
                    key={key}
                    label={key.replace(/([A-Z])/g, ' $1').toUpperCase()}
                    value={String(value)}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={s.story}>
              <Text style={s.storyBody}>No statistics available for this player.</Text>
            </View>
          ))}
        {(tab === 'Overview' || tab === 'News') && (
          <>
            <Text style={s.section}>RECENT STORIES</Text>
            {data.stories.length ? (
              data.stories.map((story) => (
                <View key={story.id} style={s.story}>
                  <Text style={s.storyMeta}>
                    {story.status} · {new Date(story.updatedAt).toLocaleDateString()}
                  </Text>
                  <Text style={s.storyTitle}>{story.headline}</Text>
                  <Text style={s.storyBody}>{story.summary}</Text>
                </View>
              ))
            ) : (
              <View style={s.story}>
                <Text style={s.storyBody}>No current canonical stories mention this player.</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 14 },
  team: { color: '#AFC5D3', fontSize: 12, marginBottom: 12 },
  firstName: { color: 'white', fontSize: 20, fontFamily: 'BarlowCondensed' },
  lastName: {
    color: 'white',
    fontSize: 38,
    fontFamily: 'BarlowCondensed',
    textTransform: 'uppercase',
  },
  initials: { color: '#C9D4DD', fontSize: 58, textAlign: 'center', paddingTop: 60 },
  tabs: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#DCE3EA' },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#00172B' },
  tabText: { fontWeight: '800', color: '#00172B' },
  body: { paddingBottom: 40 },
  center: { flex: 1, backgroundColor: C.cream, justifyContent: 'center', padding: 24 },
  error: { color: C.muted, marginTop: 12 },
  hero: { backgroundColor: '#06121E', padding: 20, paddingTop: 24 },
  image: { width: '100%', maxWidth: 290, height: 205, alignSelf: 'center', resizeMode: 'contain' },
  heroCopy: { paddingTop: 16 },
  bio: { color: '#AFC5D3', marginTop: 8 },
  section: {
    color: C.red,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 28,
    marginBottom: 10,
  },
  contract: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stats: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fact: { width: '50%', padding: 8 },
  label: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  value: { color: C.ink, fontSize: 16, fontWeight: '900', marginTop: 4 },
  story: { backgroundColor: C.white, borderRadius: 15, padding: 16, marginBottom: 9 },
  storyMeta: { color: C.red, fontSize: 13, fontWeight: '900' },
  storyTitle: { color: C.ink, fontWeight: '900', fontSize: 17, marginTop: 6 },
  storyBody: { color: C.muted, lineHeight: 19, marginTop: 6 },
});
