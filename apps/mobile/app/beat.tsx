import { normalizeDisplayHeadline } from '../../../src/lib/display-headline';
import { TEAM_FANBASES } from '../../../packages/design/team-fanbases';
import { selectBeatHeroStories } from '../../../packages/design/editorial-stories';
import type { Briefing } from '../lib/types';
import { EditorialHero, NumberedBriefing } from '../components/editorial-hero';
import { PageScrollView as ScrollView } from '../components/page-scroll-view';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { C } from '../components/screen';
import { MobileFilterBar } from '../components/mobile-filter-bar';
import { BEAT_PRIMARY, BEAT_SECONDARY, filterValue } from '../../../packages/filters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBeatPage, getHome, getCatchUp, type MobileBriefing } from '../lib/api';
import { useTeam } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';

export default function BeatScreen() {
  const { teamId } = useTeam();
  const [highlights, setHighlights] = useState<ReturnType<typeof selectBeatHeroStories<Briefing>>>(
    [],
  );
  useEffect(() => {
    let active = true;
    setHighlights([]);
    void Promise.all([
      getHome(teamId).catch(() => null),
      getCatchUp(teamId).catch(() => null),
    ]).then(([home, catchUp]) => {
      if (active) setHighlights(selectBeatHeroStories(home?.data.huddle ?? [], catchUp));
    });
    return () => {
      active = false;
    };
  }, [teamId]);
  const params = useLocalSearchParams<{ type?: string; sort?: string; range?: string }>();
  const values = useMemo(
    () => ({
      type: filterValue(BEAT_PRIMARY[0], { type: params.type ?? 'ALL' }),
      sort: filterValue(BEAT_PRIMARY[1], { sort: params.sort ?? 'UPDATED' }),
      range: filterValue(BEAT_SECONDARY[0], { range: params.range ?? 'ALL' }),
    }),
    [params.type, params.sort, params.range],
  );
  const insets = useSafeAreaInsets();
  const requestId = useRef(0);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 0, page: 1 });
  const { theme } = useTeamBranding();
  const [items, setItems] = useState<MobileBriefing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(
    async (page = 1) => {
      const id = ++requestId.current;
      setLoading(true);
      setError('');
      try {
        const result = await getBeatPage(teamId, values, page);
        if (id !== requestId.current) return;
        setItems((current) => (page === 1 ? result.briefings : [...current, ...result.briefings]));
        setPagination(result.pagination);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : 'The Beat is unavailable.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [teamId, values],
  );
  const cancelRequests = useCallback(() => {
    requestId.current++;
  }, []);
  useEffect(() => {
    setItems([]);
    setPagination({ totalItems: 0, totalPages: 0, page: 1 });
    void load();
    return cancelRequests;
  }, [load, cancelRequests]);
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={[
        s.body,
        {
          paddingBottom: Math.max(40, insets.bottom),
          paddingLeft: Math.max(12, insets.left),
          paddingRight: Math.max(12, insets.right),
        },
      ]}
      stickyHeaderIndices={[1]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <View style={{ marginHorizontal: -12 }}>
        <EditorialHero
          first="THE"
          accent="BEAT"
          tagline={`THE PULSE OF ${TEAM_FANBASES[teamId] ?? 'NFL NATION'}. NEVER MISS A BEAT.`}
        >
          <NumberedBriefing
            title="THREE & OUT"
            empty={
              loading ? 'Loading the latest developments…' : 'New developments will appear here.'
            }
            items={highlights.map((item) => ({
              id: item.id,
              title: item.headline,
              onPress: () => router.push(`/beat-story/${item.id}` as Href),
            }))}
          />
        </EditorialHero>
      </View>
      <MobileFilterBar
        primary={BEAT_PRIMARY}
        secondary={BEAT_SECONDARY}
        values={values}
        onChange={(changes) => router.setParams(changes)}
      />
      <Text accessibilityLiveRegion="polite" style={s.count}>
        {pagination.totalItems} DEVELOPMENTS
      </Text>
      {loading && !items.length ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {!loading && !error && !items.length && (
        <Text style={s.intro}>No developments match those filters.</Text>
      )}
      {items.map((item) => {
        const hot = Boolean(item.hotReadUntil && new Date(item.hotReadUntil) > new Date());
        return (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() =>
              router.push(
                `/beat-story/${item.id}?payload=${encodeURIComponent(JSON.stringify(item))}` as Href,
              )
            }
            style={s.card}
          >
            <View style={s.row}>
              <Text style={[s.category, { color: theme.primary }]}>
                {hot ? 'HOT READ' : item.category}
              </Text>
              <Text style={s.meta}>
                {item.sourceCount} SOURCE{item.sourceCount === 1 ? '' : 'S'}
              </Text>
            </View>
            <Text style={s.title}>{normalizeDisplayHeadline(item.headline)}</Text>
            <Text style={s.summary} numberOfLines={3}>
              {item.summary}
            </Text>
            <Text style={[s.open, { color: theme.primary }]}>OPEN D&D STORY →</Text>
          </Pressable>
        );
      })}
      {pagination.page < pagination.totalPages && (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void load(pagination.page + 1)}
          style={s.loadMore}
        >
          <Text>{loading ? 'Loading…' : 'Load more developments'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6f8' },
  body: { padding: 12, paddingTop: 0, paddingBottom: 40 },
  intro: { color: C.muted, lineHeight: 21, marginTop: 10, marginBottom: 22 },
  count: { marginTop: 8, marginBottom: 8, fontSize: 12, fontWeight: '700', color: '#6d7f91' },
  loadMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5DED3',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  meta: { fontSize: 11, fontWeight: '800', color: C.muted },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '900', color: C.ink, marginTop: 9 },
  summary: { fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 8 },
  open: { fontSize: 12, fontWeight: '900', marginTop: 15 },
  error: { color: C.red, fontWeight: '700', marginBottom: 16 },
});
