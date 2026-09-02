import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { completeCatchUp, getCatchUp } from '../lib/api';
import type { CatchUpData } from '../lib/types';
import { useTeam } from '../lib/team-context';

export default function CatchUp() {
  const { teamId } = useTeam();
  const [data, setData] = useState<CatchUpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getCatchUp(teamId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Get Caught Up is unavailable.'); }
    finally { setLoading(false); }
  }, [teamId]);
  useEffect(() => { void load(); }, [load]);
  const markComplete = async () => {
    try { await completeCatchUp(teamId); setComplete(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save progress.'); }
  };
  return <ScrollView style={s.page} contentContainerStyle={s.body}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
    <Eyebrow>GET CAUGHT UP</Eyebrow><Heading>While you were away</Heading>
    {data ? <Text style={s.meta}>Since {new Date(data.baselineAt).toLocaleString()} · {data.estimatedReadMinutes} min</Text> : null}
    {loading && !data ? <ActivityIndicator color={C.red} style={s.loader} /> : null}
    {error ? <View style={s.empty}><Text style={s.emptyTitle}>Couldn’t load your update.</Text><Text style={s.emptyBody}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.retry}>TRY AGAIN</Text></Pressable></View> : null}
    {!loading && !error && data && (!data.eligible || !data.items.length) ? <View style={s.empty}>
      <Text style={s.emptyTitle}>{data.eligible ? 'You’re caught up.' : 'Your baseline is set.'}</Text>
      <Text style={s.emptyBody}>{data.eligible ? 'Nothing meaningful has changed since your last visit.' : 'Come back after the team picture changes.'}</Text>
    </View> : null}
    {data?.items.map((item) => <View key={item.id} style={s.card}>
      <Text style={s.type}>{item.type}</Text><Text style={s.title}>{item.headline}</Text>
      <Text style={s.summary}>{item.summary}</Text>
      {item.whatChanged ? <><Text style={s.label}>WHAT CHANGED</Text><Text style={s.detail}>{item.whatChanged}</Text></> : null}
      <Text style={s.label}>WHY IT MATTERS</Text><Text style={s.detail}>{item.whyItMatters}</Text>
      {item.sources.slice(0, 3).map((source) => <Pressable key={source.id} onPress={() => Linking.openURL(source.sourceUrl)}>
        <Text style={s.source}>{source.sourceName} →</Text>
      </Pressable>)}
    </View>)}
    {data?.items.length ? <Pressable style={s.done} disabled={complete} onPress={() => void markComplete()}>
      <Text style={s.doneText}>{complete ? 'YOU’RE CAUGHT UP' : 'MARK ME CAUGHT UP'}</Text>
    </Pressable> : null}
  </ScrollView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream }, body: { padding: 20, paddingBottom: 42 },
  meta: { color: C.muted, marginTop: 12, marginBottom: 20 }, loader: { marginTop: 40 },
  empty: { backgroundColor: C.white, borderRadius: 18, padding: 24, marginTop: 24 },
  emptyTitle: { color: C.ink, fontSize: 22, fontWeight: '900' }, emptyBody: { color: C.muted, lineHeight: 21, marginTop: 8 },
  retry: { color: C.red, fontWeight: '900', marginTop: 18 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 20, marginTop: 14, borderLeftColor: C.red, borderLeftWidth: 4 },
  type: { color: C.red, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: C.ink, fontSize: 22, lineHeight: 26, fontWeight: '900', marginTop: 9 },
  summary: { color: C.muted, fontSize: 16, lineHeight: 23, marginTop: 10 }, label: { color: C.red, fontSize: 13, letterSpacing: 1.2, fontWeight: '900', marginTop: 18 },
  detail: { color: C.ink, lineHeight: 20, marginTop: 6 }, source: { color: C.navy, fontWeight: '900', marginTop: 14 },
  done: { backgroundColor: C.navy, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 20 },
  doneText: { color: C.white, fontWeight: '900', letterSpacing: 1 },
});
