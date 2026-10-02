import { CrewFeed, CrewSettings, CrewPhoto } from '../components/crew-feed';
import { getEditorialHeroTheme } from '../../../src/lib/team-theme-tokens';
import { PageScrollView as ScrollView } from '../components/page-scroll-view';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C } from '../components/screen';
import { createCrew, createCrewInvite, getCrew, type MobileCrew } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTeam } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';
export default function CrewScreen() {
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const heroAccent = getEditorialHeroTheme(teamId).heroPrimaryAccent;
  const [crew, setCrew] = useState<MobileCrew | null | undefined>(),
    [tab, setTab] = useState<'FEED' | 'LEADERBOARD' | 'MEMBERS' | 'SETTINGS'>('FEED'),
    [name, setName] = useState(`${user?.displayName?.split(' ')[0] ?? 'My'}’s ${teamId} Crew`),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCrew(await getCrew());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your crew.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (crew === undefined)
    return (
      <View style={[s.page, s.body]}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text accessibilityRole="alert">{error}</Text>
            <Pressable onPress={() => void load()} style={s.button}>
              <Text>Try again</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  if (!crew)
    return (
      <ScrollView style={s.page} contentContainerStyle={s.body}>
        <View style={s.hero}>
          <Text style={[s.heroEyebrow, { color: heroAccent }]}>BUILD YOUR CREW</Text>
          <Text style={s.heroTitle}>Football is better with your people.</Text>
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={s.copy}>
            {error}
          </Text>
        )}
        <TextInput
          accessibilityLabel="Crew name"
          value={name}
          onChangeText={setName}
          style={s.input}
        />
        <Pressable
          style={[s.button, { backgroundColor: theme.primaryFill }]}
          disabled={saving || !name.trim()}
          onPress={async () => {
            setSaving(true);
            setError('');
            try {
              await createCrew(name, teamId);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to create crew.');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Text style={[s.buttonText, { color: theme.onPrimary }]}>CREATE MY CREW</Text>
        </Pressable>
      </ScrollView>
    );
  const invite = async () => {
    try {
      const result = await createCrewInvite('SHARE_LINK');
      await Share.share({
        message: `${user?.displayName ?? 'A friend'} invited you to join ${crew.name} on Down & Distance. ${result.invite.inviteUrl}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create invite.');
    }
  };
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={s.hero}>
        <Text style={[s.heroEyebrow, { color: heroAccent }]}>MY CREW</Text>
        {crew.photoUrl && <CrewPhoto url={crew.photoUrl} />}
        <Text style={s.heroTitle}>{crew.name}</Text>
        <Text style={s.sub}>
          {crew.members.length} members · {crew.teamAbbr} fans
        </Text>
        <Pressable
          style={[s.button, { backgroundColor: theme.primaryFill }]}
          onPress={() => void invite()}
        >
          <Text style={[s.buttonText, { color: theme.onPrimary }]}>INVITE FRIENDS</Text>
        </Pressable>
      </View>
      <View style={s.score}>
        <Stat label="THIS WEEK" value={`${crew.weeklyYards} YDS`} />
        <Stat label="CREW RANK" value={`#${crew.rank}`} />
        <Stat label="MEMBERS" value={String(crew.members.length)} />
      </View>
      <View style={s.tabs}>
        {(['FEED', 'LEADERBOARD', 'MEMBERS', 'SETTINGS'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[s.tab, tab === value && { borderBottomColor: theme.primary }]}
          >
            <Text style={[s.tabText, tab === value && { color: theme.primary }]}>{value}</Text>
          </Pressable>
        ))}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.copy}>
          {error}
        </Text>
      )}
      {tab === 'FEED' && <CrewFeed crew={crew} onRefresh={load} />}
      {tab === 'SETTINGS' && <CrewSettings crew={crew} onRefresh={load} />}
      {tab === 'LEADERBOARD'
        ? [...crew.members]
            .sort((a, b) => b.weeklyYards - a.weeklyYards)
            .map((member, index) => (
              <View key={member.id} style={s.member}>
                <Text style={s.rank}>{index + 1}</Text>
                <Text style={s.memberName}>{member.displayName}</Text>
                <Text style={[s.yards, { color: theme.primary }]}>{member.weeklyYards} YDS</Text>
              </View>
            ))
        : null}
      {tab === 'MEMBERS'
        ? crew.members.map((member) => (
            <View key={member.id} style={s.card}>
              <Text style={s.title}>{member.displayName}</Text>
              <Text style={s.copy}>
                {member.role === 'OWNER' ? 'Crew Owner' : 'Member'} · {member.lifetimeYards}{' '}
                lifetime yards
              </Text>
            </View>
          ))
        : null}
    </ScrollView>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F8FA' },
  body: { padding: 18, paddingBottom: 40 },
  hero: {
    backgroundColor: '#001222',
    padding: 28,
    marginHorizontal: -18,
    marginTop: -18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  heroEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  heroTitle: {
    color: 'white',
    fontSize: 32,
    fontFamily: 'BarlowCondensedItalic',
    textTransform: 'uppercase',
  },
  sub: { color: '#c4d4e3', marginTop: 8 },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#D6CEC2',
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontWeight: '800',
    marginTop: 28,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  buttonText: { fontWeight: '900', letterSpacing: 0.8 },
  score: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginTop: 22,
    flexDirection: 'row',
  },
  stat: { flex: 1 },
  statLabel: { color: C.muted, fontSize: 10, fontWeight: '900' },
  statValue: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 6 },
  tabs: { flexDirection: 'row', marginTop: 18, borderBottomWidth: 1, borderBottomColor: '#DDD6CC' },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 11, fontWeight: '900', color: C.muted },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 17, marginTop: 11 },
  actor: { fontSize: 13, fontWeight: '800', color: C.muted },
  title: { fontSize: 17, fontWeight: '900', color: C.ink, marginTop: 6 },
  copy: { color: C.muted, lineHeight: 20, marginTop: 5 },
  member: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rank: { width: 30, fontWeight: '900', color: C.ink },
  memberName: { flex: 1, fontWeight: '900', color: C.ink },
  yards: { fontWeight: '900' },
});
