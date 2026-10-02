import { FranchiseExperience } from '../components/franchise-experience';
import { EditorialHero } from '../components/editorial-hero';
import { SectionMenu } from '../components/section-menu';
import { useTeamBranding } from '../lib/team-branding';
import { PageScrollView as ScrollView } from '../components/page-scroll-view';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { C } from '../components/screen';
import { getFrontOffice, type FrontOfficeData } from '../lib/api';
import { useTeam } from '../lib/team-context';
const money = (value: number | null | undefined) =>
  value == null ? '—' : `$${(value / 1_000_000).toFixed(1)}M`;
export default function FrontOffice() {
  const [franchiseActive, setFranchiseActive] = useState(false);
  const { theme } = useTeamBranding();
  const { teamId } = useTeam(),
    [data, setData] = useState<FrontOfficeData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [section, setSection] = useState<'EXPERIENCE' | 'ROSTER' | 'TRANSACTIONS'>('EXPERIENCE');
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getFrontOffice(teamId));
    } catch {
      setError('Front Office data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);
  useEffect(() => {
    void load();
  }, [load]);
  const groups = useMemo(() => {
    const map = new Map<string, FrontOfficeData['roster']>();
    for (const player of data?.roster ?? []) {
      const rows = map.get(player.position) ?? [];
      rows.push(player);
      map.set(player.position, rows);
    }
    return [...map.entries()];
  }, [data]);
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {!franchiseActive && (
        <SectionMenu
          navigation={{ inset: 16, top: true }}
        title="Front Office sections"
          items={(['EXPERIENCE', 'ROSTER', 'TRANSACTIONS'] as const).map((item) => ({
            label:
              item === 'EXPERIENCE'
                ? 'Front Office'
                : item === 'ROSTER'
                  ? 'Roster & contracts'
                  : 'Transactions',
            selected: section === item,
            onPress: () => setSection(item),
          }))}
        />
      )}
      {section === 'EXPERIENCE' ? (
        <FranchiseExperience
          key={teamId}
          onActiveChange={setFranchiseActive}
          onRealRoster={() => setSection('ROSTER')}
          onRealTransactions={() => setSection('TRANSACTIONS')}
        />
      ) : (
        <>
          <EditorialHero
            first="FRONT"
            accent="OFFICE"
            tagline={`${data?.team.name ?? teamId} · BUILD THE ROSTER. KNOW THE NUMBERS.`}
          />
          {data?.cap ? (
            <View style={s.cap}>
              <Stat label="CAP SPACE" value={money(data.cap.availableCap)} />
              <Stat label="USED" value={money(data.cap.usedCap)} />
              <Stat label="LIMIT" value={money(data.cap.totalCap)} />
            </View>
          ) : null}
          <View style={s.tabs}>
            {(['ROSTER', 'TRANSACTIONS'] as const).map((item) => (
              <Pressable
                key={item}
                style={[s.tab, section === item && { backgroundColor: theme.primaryFill }]}
                onPress={() => setSection(item)}
              >
                <Text style={[s.tabText, section === item && { color: theme.onPrimary }]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {loading && !data ? <ActivityIndicator color={C.red} style={s.loader} /> : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          {!loading && !error && section === 'ROSTER' && !groups.length && (
            <View style={s.empty}>
              <Text style={s.name}>No roster data available.</Text>
              <Text style={s.meta}>Pull down to check again.</Text>
            </View>
          )}
          {section === 'ROSTER' ? (
            groups.map(([position, players]) => (
              <View key={position}>
                <Text style={s.section}>{position}</Text>
                {players.map((player) => (
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
                    <View style={s.playerCopy}>
                      <Text style={s.name}>{player.name}</Text>
                      <Text style={s.meta}>
                        {player.status}
                        {player.age ? ` · Age ${player.age}` : ''}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.capHit}>{money(player.capHit)}</Text>
                      <Text style={s.meta}>
                        {player.years ? `${player.years} yrs` : 'Contract'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
          ) : data?.transactions.length ? (
            data.transactions.map((item) => (
              <Pressable
                key={item.id}
                style={s.transaction}
                onPress={() =>
                  router.push({
                    pathname: '/story/[id]',
                    params: { id: item.id, payload: JSON.stringify(item.story) },
                  })
                }
              >
                <Text style={s.transactionMeta}>
                  {item.status} · {new Date(item.occurredAt).toLocaleDateString()}
                </Text>
                <Text style={s.transactionTitle}>{item.headline}</Text>
                <Text style={s.transactionBody}>{item.summary}</Text>
                {item.source ? <Text style={s.source}>{item.source} →</Text> : null}
              </Pressable>
            ))
          ) : (
            <View style={s.empty}>
              <Text style={s.name}>No published transactions yet.</Text>
              <Text style={s.meta}>
                Verified roster movement will appear here from the Story Engine.
              </Text>
            </View>
          )}
          <Text style={s.updated}>
            Roster and contract data updated{' '}
            {data ? new Date(data.updatedAt).toLocaleDateString() : '—'}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#001222' },
  body: { padding: 16, paddingBottom: 40 },
  team: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 66, height: 66, marginRight: 14 },
  cap: {
    backgroundColor: C.navy,
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: { color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { color: C.white, fontSize: 18, fontWeight: '900', marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tab: { flex: 1, borderRadius: 12, padding: 13, alignItems: 'center', backgroundColor: C.white },
  tabActive: { backgroundColor: C.red },
  tabText: { color: C.ink, fontSize: 13, fontWeight: '900' },
  tabTextActive: { color: C.white },
  loader: { marginTop: 35 },
  error: { color: C.red, marginTop: 20 },
  section: {
    color: '#A8BAC4',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 22,
    marginBottom: 8,
  },
  player: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 11,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#DDE1E3', marginRight: 11 },
  playerCopy: { flex: 1 },
  name: { color: C.ink, fontWeight: '900', fontSize: 15 },
  meta: { color: C.muted, fontSize: 13, marginTop: 3 },
  capHit: { color: C.ink, fontWeight: '900', fontSize: 13, textAlign: 'right' },
  transaction: { backgroundColor: C.white, borderRadius: 16, padding: 17, marginTop: 10 },
  transactionMeta: { color: C.red, fontWeight: '900', fontSize: 13 },
  transactionTitle: { color: C.ink, fontWeight: '900', fontSize: 18, lineHeight: 22, marginTop: 6 },
  transactionBody: { color: C.muted, lineHeight: 19, marginTop: 7 },
  source: { color: C.ink, fontWeight: '900', fontSize: 13, marginTop: 10 },
  empty: { backgroundColor: C.white, borderRadius: 16, padding: 20, marginTop: 18 },
  updated: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
