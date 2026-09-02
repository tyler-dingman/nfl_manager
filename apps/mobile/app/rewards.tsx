import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { claimReward, getRewards, type RewardsDashboard } from '../lib/api';
import { router } from 'expo-router';
export default function Rewards() {
  const [data, setData] = useState<RewardsDashboard | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getRewards());
    } catch {
      setMessage('Rewards are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const claim = async (id: string) => {
    try {
      await claimReward(id);
      setMessage('Reward claimed.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to claim reward.');
    }
  };
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Eyebrow>MOVE THE CHAINS</Eyebrow>
      <Heading>Engagement Rewards</Heading>
      {loading && !data ? <ActivityIndicator color={C.red} style={s.loader} /> : null}
      {data ? (
        <>
          <View style={s.hero}>
            <Text style={s.big}>{data.progress.currentDriveYards}</Text>
            <Text style={s.unit}>YARDS THIS DRIVE</Text>
            <View style={s.track}>
              <View
                style={[s.fill, { width: `${Math.min(100, data.progress.currentDriveYards)}%` }]}
              />
            </View>
            <Text style={s.stats}>
              {data.progress.touchdowns} touchdowns · {data.progress.lifetimeYards} lifetime yards
            </Text>
          </View>
          <Text style={s.section}>THE LOCKER</Text>
          {data.rewards.length ? (
            data.rewards.map((r) => (
              <View key={r.id} style={s.reward}>
                <View style={s.rewardCopy}>
                  <Text style={s.title}>{r.title}</Text>
                  <Text style={s.desc}>{r.description}</Text>
                  <Text style={s.status}>
                    {r.status} · {r.thresholdYards} YARDS
                  </Text>
                  {r.couponCode ? <Text style={s.code}>{r.couponCode}</Text> : null}
                </View>
                {r.status === 'AVAILABLE' ? (
                  <Pressable style={s.claim} onPress={() => void claim(r.id)}>
                    <Text style={s.claimText}>CLAIM</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          ) : (
            <View style={s.empty}>
              <Text style={s.title}>Your locker is empty—for now.</Text>
              <Text style={s.desc}>
                Read stories, finish Trivia, and keep showing up to move the chains and unlock
                rewards.
              </Text>
            </View>
          )}
          <Pressable style={s.shop} onPress={() => router.push('/merch')}>
            <Text style={s.shopText}>SHOP D&amp;D MERCH →</Text>
          </Pressable>
        </>
      ) : null}
      {message ? <Text style={s.message}>{message}</Text> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 40 },
  loader: { marginTop: 40 },
  hero: { backgroundColor: C.navy, borderRadius: 20, padding: 22, marginTop: 22 },
  big: { color: C.white, fontSize: 48, fontWeight: '900' },
  unit: { color: C.gold, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  track: {
    height: 8,
    backgroundColor: '#30404B',
    borderRadius: 5,
    marginTop: 18,
    overflow: 'hidden',
  },
  fill: { height: 8, backgroundColor: C.gold },
  stats: { color: '#BAC7CF', marginTop: 12 },
  section: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 28,
    marginBottom: 10,
  },
  reward: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 17,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardCopy: { flex: 1 },
  title: { color: C.ink, fontSize: 17, fontWeight: '900' },
  desc: { color: C.muted, lineHeight: 19, marginTop: 4 },
  status: { color: C.red, fontSize: 13, fontWeight: '900', marginTop: 10 },
  code: { color: C.ink, fontWeight: '900', marginTop: 8 },
  claim: { backgroundColor: C.red, borderRadius: 10, padding: 11 },
  claimText: { color: C.white, fontSize: 13, fontWeight: '900' },
  shop: { backgroundColor: C.red, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 14 },
  shopText: { color: C.white, fontWeight: '900' },
  empty: { backgroundColor: C.white, borderRadius: 16, padding: 20 },
  message: { color: C.red, textAlign: 'center', marginTop: 16 },
});
