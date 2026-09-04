import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { createCrew, createCrewInvite, getCrew, type MobileCrew } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTeam } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';
export default function CrewScreen() {
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const [crew, setCrew] = useState<MobileCrew | null | undefined>(),
    [tab, setTab] = useState<'FEED' | 'LEADERBOARD' | 'MEMBERS'>('FEED'),
    [name, setName] = useState(`${user?.displayName?.split(' ')[0] ?? 'My'}’s ${teamId} Crew`),
    [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCrew(await getCrew());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (crew === undefined) return <View style={s.page} />;
  if (!crew)
    return (
      <ScrollView style={s.page} contentContainerStyle={s.body}>
        <Eyebrow>BUILD YOUR CREW</Eyebrow>
        <Heading>Football is better with your people.</Heading>
        <TextInput
          accessibilityLabel="Crew name"
          value={name}
          onChangeText={setName}
          style={s.input}
        />
        <Pressable
          style={[s.button, { backgroundColor: theme.primaryFill }]}
          onPress={async () => {
            await createCrew(name, teamId);
            void load();
          }}
        >
          <Text style={[s.buttonText, { color: theme.onPrimary }]}>CREATE MY CREW</Text>
        </Pressable>
      </ScrollView>
    );
  const invite = async () => {
    const result = await createCrewInvite('SHARE_LINK');
    await Share.share({
      message: `${user?.displayName ?? 'A friend'} invited you to join ${crew.name} on Down & Distance. ${result.invite.inviteUrl}`,
    });
  };
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {' '}
      <Eyebrow>MY CREW</Eyebrow>
      <Heading>{crew.name}</Heading>
      <Text style={s.sub}>
        {crew.members.length} members · {crew.teamAbbr} fans
      </Text>
      <Pressable
        style={[s.button, { backgroundColor: theme.primaryFill }]}
        onPress={() => void invite()}
      >
        <Text style={[s.buttonText, { color: theme.onPrimary }]}>INVITE FRIENDS</Text>
      </Pressable>
      <View style={s.score}>
        <Stat label="THIS WEEK" value={`${crew.weeklyYards} YDS`} />
        <Stat label="CREW RANK" value={`#${crew.rank}`} />
        <Stat label="MEMBERS" value={String(crew.members.length)} />
      </View>
      <View style={s.tabs}>
        {(['FEED', 'LEADERBOARD', 'MEMBERS'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[s.tab, tab === value && { borderBottomColor: theme.primary }]}
          >
            <Text style={[s.tabText, tab === value && { color: theme.primary }]}>{value}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'FEED'
        ? crew.activity.map((item) => (
            <View key={item.id} style={s.card}>
              <Text style={s.actor}>
                {item.actorName ?? 'Crew member'} · {item.type.replaceAll('_', ' ').toLowerCase()}
              </Text>
              {item.metadata.title ? <Text style={s.title}>{item.metadata.title}</Text> : null}
              {item.message ? <Text style={s.copy}>{item.message}</Text> : null}
            </View>
          ))
        : null}
      {tab === 'LEADERBOARD'
        ? crew.members
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
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 18, paddingBottom: 40 },
  sub: { color: C.muted, marginTop: 8 },
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
    backgroundColor: C.navy,
    borderRadius: 18,
    padding: 18,
    marginTop: 22,
    flexDirection: 'row',
  },
  stat: { flex: 1 },
  statLabel: { color: C.gold, fontSize: 10, fontWeight: '900' },
  statValue: { color: C.white, fontSize: 18, fontWeight: '900', marginTop: 6 },
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
