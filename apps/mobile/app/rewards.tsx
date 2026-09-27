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
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, SvgUri } from 'react-native-svg';
import { router, type Href } from 'expo-router';
import { PageScrollView } from '../components/page-scroll-view';
import { claimReward, getRewards, type RewardsDashboard } from '../lib/api';
import { useTeam } from '../lib/team-context';
import { API_BASE_URL } from '../lib/network';
import { getEditorialHeroTheme } from '../../../src/lib/team-theme-tokens';
import { REWARD_TIERS, rewardTierProgress } from '../../../packages/rewards/presentation';
import { REWARD_WAYS } from '../../../src/features/rewards/ways';

export default function Rewards() {
  const { teamId } = useTeam();
  const accent = getEditorialHeroTheme(teamId).heroPrimaryAccent;
  const [data, setData] = useState<RewardsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [allWays, setAllWays] = useState(false),
    [allRewards, setAllRewards] = useState(false),
    [details, setDetails] = useState(false);
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
    if (claiming) return;
    setClaiming(id);
    setMessage(null);
    try {
      await claimReward(id);
      await load();
      setMessage('Reward claimed.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to claim reward.');
    } finally {
      setClaiming(null);
    }
  };
  const tier = rewardTierProgress(data?.progress.lifetimeYards ?? 0);
  return (
    <PageScrollView
      style={s.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={s.hero}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 0,
            top: 20,
            width: 160,
            height: 130,
            opacity: 0.13,
          }}
        >
          <SvgUri
            width="100%"
            height="100%"
            uri={`${API_BASE_URL}/assets/front-office-widget-story-graphics/svg/playbook-pattern.svg`}
          />
        </View>
        <Text style={[s.eyebrow, { color: accent }]}>MOVE THE CHAINS</Text>
        <Text style={s.title}>ENGAGEMENT</Text>
        <Text style={[s.title, { color: accent }]}>REWARDS</Text>
        <Text style={s.intro}>Be active. Earn points. Unlock rewards. Keep showing up.</Text>
        {data && (
          <View style={s.progress}>
            <Text style={s.progressHeading}>Your Progress</Text>
            <View style={s.progressRow}>
              <View
                style={s.ring}
                accessibilityLabel={`${tier.total} lifetime yards. ${tier.current.name}. ${tier.remaining} yards to next tier`}
              >
                <Svg width={128} height={128} viewBox="0 0 120 120">
                  <Circle cx={60} cy={60} r={51} stroke="#20384a" strokeWidth={9} fill="none" />
                  <Circle
                    cx={60}
                    cy={60}
                    r={51}
                    stroke="#ffbd08"
                    strokeWidth={9}
                    fill="none"
                    strokeDasharray={`${tier.fraction * 320.44} 320.44`}
                    rotation={-90}
                    origin="60,60"
                    strokeLinecap="round"
                  />
                </Svg>
                <View style={s.ringText}>
                  <Text style={s.total}>{tier.total}</Text>
                  <Text style={s.hint}>{tier.next ? `/ ${tier.next.min}` : 'LEGEND'}</Text>
                  <Text style={s.ringLabel}>MOVE THE CHAINS</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Feather name="shield" size={32} color="white" />
                <Text style={s.hint}>Current Tier</Text>
                <Text style={s.tierName}>{tier.current.name}</Text>
                <Text style={s.hint}>
                  {tier.next ? `${tier.remaining} yards to next tier` : 'Highest tier reached'}
                </Text>
              </View>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${tier.fraction * 100}%` }]} />
            </View>
            <Text style={[s.hint, { textAlign: 'right' }]}>{tier.total} lifetime yards</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetails(!details)}
              style={s.touch}
            >
              <Text style={{ color: accent }}>View All Tiers →</Text>
            </Pressable>
          </View>
        )}
      </View>
      {loading && !data && <ActivityIndicator style={{ padding: 24 }} />}
      {message && (
        <Text accessibilityRole="alert" style={s.message}>
          {message}
        </Text>
      )}
      {data && (
        <View style={s.content}>
          <View style={s.section}>
            <View style={s.headingRow}>
              <Text style={s.heading}>Your Stats</Text>
              <Text style={s.muted}>All time</Text>
            </View>
            <View style={s.stats}>
              {(
                [
                  { label: 'Touchdowns', value: data.progress.touchdowns, icon: 'award' },
                  { label: 'Day Streak', value: data.stats?.dayStreak ?? '—', icon: 'zap' },
                  {
                    label: 'Crew Rank',
                    value: data.stats?.crewRank ? `#${data.stats.crewRank}` : '—',
                    icon: 'users',
                  },
                  {
                    label: 'Global Rank',
                    value: data.stats ? `#${data.stats.globalRank}` : '—',
                    icon: 'bar-chart',
                  },
                ] as const
              ).map((item) => (
                <View style={s.stat} key={item.label}>
                  <Feather
                    name={item.icon}
                    size={25}
                    color={
                      item.label === 'Touchdowns' || item.label === 'Day Streak'
                        ? '#d99b00'
                        : '#00172b'
                    }
                  />
                  <View>
                    <Text style={s.value}>{item.value}</Text>
                    <Text style={s.muted}>{item.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={s.section}>
            <View style={s.headingRow}>
              <Text style={s.heading}>Reward Tiers</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDetails(!details)}
                style={s.touch}
              >
                <Text style={s.link}>View All →</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.rail}
            >
              {REWARD_TIERS.map((t) => (
                <View key={t.name} style={[s.tier, t.name === tier.current.name && s.current]}>
                  <Feather name="shield" color={t.color} size={30} />
                  <Text style={s.cardTitle}>{t.name.toUpperCase()}</Text>
                  <Text style={s.muted}>{t.range}</Text>
                  {t.name === tier.current.name && <Text style={s.currentLabel}>CURRENT</Text>}
                </View>
              ))}
            </ScrollView>
            {details && (
              <Text style={s.note}>
                Tiers reflect lifetime yards. Each 100 yards earns a touchdown. Rewards unlock at
                their own milestones below; yards are never spent.
              </Text>
            )}
          </View>
          <View style={s.section}>
            <View style={s.headingRow}>
              <Text style={s.heading}>Ways to Earn Points</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllWays(!allWays)}
                style={s.touch}
              >
                <Text style={s.link}>{allWays ? 'Show Less' : 'View All →'}</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={s.rail}
              showsHorizontalScrollIndicator={false}
            >
              {REWARD_WAYS.slice(0, allWays ? undefined : 5).map((w) => (
                <Pressable
                  accessibilityRole="link"
                  key={w.action}
                  style={s.way}
                  onPress={() => router.push(w.href as Href)}
                >
                  <Feather
                    name={
                      w.icon === 'trivia'
                        ? 'help-circle'
                        : w.icon === 'articles'
                          ? 'file-text'
                          : w.icon === 'game'
                            ? 'play-circle'
                            : w.icon === 'crew'
                              ? 'users'
                              : w.icon === 'checkin'
                                ? 'flag'
                                : 'target'
                    }
                    size={24}
                    color="#00172b"
                  />
                  <Text style={s.cardTitle}>{w.label}</Text>
                  <Text style={s.link}>
                    +{w.yards} {w.yards === 1 ? 'yard' : 'yards'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={s.section}>
            <View style={s.headingRow}>
              <Text style={s.heading}>Featured Rewards</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllRewards(!allRewards)}
                style={s.touch}
              >
                <Text style={s.link}>{allRewards ? 'Show Less' : 'View All →'}</Text>
              </Pressable>
            </View>
            {data.rewards.slice(0, allRewards ? undefined : 4).map((r) => (
              <View style={s.reward} key={r.id}>
                <Feather
                  name={r.type === 'STICKER_PACK' ? 'gift' : 'shopping-bag'}
                  size={30}
                  color="#00172b"
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.value}>{r.title}</Text>
                  <Text style={s.muted}>
                    {r.thresholdYards} lifetime yards · {r.status.toLowerCase()}
                  </Text>
                  {r.couponCode && (
                    <Text selectable style={s.value}>
                      {r.couponCode}
                    </Text>
                  )}
                  {r.status === 'AVAILABLE' && (
                    <Pressable
                      disabled={claiming !== null}
                      accessibilityRole="button"
                      onPress={() => void claim(r.id)}
                      style={s.touch}
                    >
                      <Text style={s.link}>
                        {claiming === r.id
                          ? 'Claiming…'
                          : r.type === 'STICKER_PACK'
                            ? 'Claim reward'
                            : 'Generate code'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </PageScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7f9' },
  hero: { backgroundColor: '#001222', padding: 20 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  title: { color: 'white', fontSize: 32, fontWeight: '900', fontStyle: 'italic', lineHeight: 34 },
  intro: { color: '#d2dfeb', fontSize: 14, lineHeight: 21, marginTop: 12 },
  progress: { backgroundColor: '#0b2030', borderRadius: 12, padding: 16, marginTop: 18 },
  progressHeading: { color: 'white', fontSize: 16, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
  ring: { width: 128, height: 128 },
  ringText: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  total: { color: 'white', fontSize: 30, fontWeight: '900', fontStyle: 'italic' },
  hint: { color: '#c4d4e3', fontSize: 12, marginTop: 4 },
  ringLabel: { fontSize: 8, color: '#c4d4e3', marginTop: 4 },
  tierName: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
  },
  track: {
    height: 8,
    backgroundColor: '#20384a',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: { height: 8, backgroundColor: '#ffbd08' },
  content: { padding: 12, gap: 12 },
  section: { backgroundColor: 'white', padding: 12, borderRadius: 12 },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heading: { fontSize: 16, fontWeight: '800', color: '#00172b' },
  muted: { fontSize: 11, color: '#637f99', marginTop: 3 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5ecf2',
    padding: 12,
    borderRadius: 9,
  },
  value: { fontSize: 14, fontWeight: '800', color: '#00172b' },
  rail: { gap: 10, paddingBottom: 4 },
  tier: {
    width: 102,
    borderWidth: 1,
    borderColor: '#e5ecf2',
    borderRadius: 9,
    padding: 10,
    alignItems: 'center',
  },
  current: { backgroundColor: '#fff9e9', borderColor: '#efad00' },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00172b',
    marginTop: 6,
    textAlign: 'center',
  },
  currentLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00172b',
    backgroundColor: '#ffbd08',
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  way: {
    width: 112,
    minHeight: 105,
    borderWidth: 1,
    borderColor: '#e5ecf2',
    borderRadius: 9,
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  reward: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5ecf2',
    borderRadius: 9,
    padding: 14,
    marginBottom: 8,
  },
  touch: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#0069ad', fontSize: 12, fontWeight: '600' },
  note: { color: '#637f99', fontSize: 12, lineHeight: 19, marginTop: 10 },
  message: { padding: 16, color: '#b42318' },
});
