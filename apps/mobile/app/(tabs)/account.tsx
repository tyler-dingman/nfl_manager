import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { PageScrollView } from '../../components/page-scroll-view';
import { API_BASE_URL, getTeams, type TeamOption } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { authenticatedFetch } from '../../lib/auth';
import { useTeam } from '../../lib/team-context';
import { ensureAccessibleTextColor } from '../../../../src/lib/color-utils';
import { useTeamBranding } from '../../lib/team-branding';
import { getEditorialHeroTheme } from '../../../../src/lib/team-theme-tokens';

import {
  ACCOUNT_PREFERENCES,
  loadAccountData,
  accountMutation,
  type AccountData,
} from '../../../../packages/account/model';

export default function Account() {
  const { user, logout } = useAuth();
  const { teamId } = useTeam();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  useEffect(() => {
    void getTeams()
      .then(setTeams)
      .catch(() => {});
  }, []);
  const team = teams.find((t) => t.abbr === teamId);
  const { theme } = useTeamBranding();
  const linkColor = ensureAccessibleTextColor(theme.primary, '#ffffff');
  const accent = getEditorialHeroTheme(teamId).heroPrimaryAccent;
  const [data, setData] = useState<AccountData | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () => (user ? loadAccountData(authenticatedFetch, user.id).then(setData) : Promise.resolve()),
    [user],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  };
  const go = (href: string) => router.push(href as Href);
  const photo = user?.avatarUrl ? (
    <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
  ) : (
    <View style={[s.avatar, s.fallback]}>
      <Feather name="user" size={36} color="#00172b" />
    </View>
  );
  const overview = [
    {
      label: 'Trivia Points',
      value: data?.points?.toLocaleString() ?? '—',
      href: '/rewards',
      icon: 'award',
    },
    {
      label: 'Global Rank',
      value: data?.rank ? `#${data.rank}` : '—',
      href: '/trivia',
      icon: 'users',
    },
    {
      label: 'Favorite Team',
      value: team?.name ?? 'Choose a team',
      href: '/team-select',
      icon: 'shield',
    },
    { label: 'Crew', value: data?.crew ?? 'No crew yet', href: '/crew', icon: 'users' },
  ] as const;
  const webSecurity = () => void Linking.openURL(`${API_BASE_URL}/account/privacy-security`);
  return (
    <PageScrollView style={s.page}>
      <View style={s.hero}>
        <Text style={[s.eyebrow, { color: accent }]}>MY ACCOUNT</Text>
        <Text style={s.title}>{user?.displayName ?? 'Your account'}</Text>
        <Text style={s.intro}>
          Manage your account, preferences, and how you appear across Down &amp; Distance.
        </Text>
        <View style={s.heroPhoto}>
          {photo}
          <Pressable accessibilityRole="button" style={s.heroButton} onPress={() => go('/profile')}>
            <Feather name="edit-2" size={15} color="white" />
            <Text style={s.white}>Edit Profile</Text>
          </Pressable>
        </View>
      </View>
      <View style={s.content}>
        <View style={s.overview}>
          {overview.map((item) => (
            <Pressable
              accessibilityRole="link"
              key={item.label}
              style={s.stat}
              onPress={() => go(item.href)}
            >
              <Feather
                name={item.icon}
                size={25}
                color={item.label === 'Trivia Points' ? '#dda200' : linkColor}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.strong}>{item.value}</Text>
                <Text style={s.muted}>{item.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {message && (
          <Text accessibilityRole="alert" style={{ color: '#b42318' }}>
            {message}
          </Text>
        )}
        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="user" size={20} color="#00172b" />
              <Text style={s.heading}>Profile Information</Text>
            </View>
            <Pressable style={s.button} onPress={() => go('/profile')}>
              <Text style={[s.link, { color: linkColor }]}>Edit</Text>
            </Pressable>
          </View>
          <View style={s.field}>
            <Text style={s.muted}>Display Name</Text>
            <Text style={s.value}>{user?.displayName}</Text>
          </View>
          <View style={s.field}>
            <Text style={s.muted}>Email</Text>
            <Text style={s.value}>{user?.primaryEmail ?? 'No email on file'}</Text>
          </View>
          <View style={s.field}>
            <Text style={s.muted}>Profile Picture</Text>
            <View style={s.photoRow}>
              {photo}
              <Pressable style={s.button} onPress={() => go('/profile')}>
                <Text style={[s.link, { color: linkColor }]}>Change Photo</Text>
              </Pressable>
            </View>
          </View>
          <View style={s.field}>
            <Text style={s.muted}>Favorite Team</Text>
            <View style={s.photoRow}>
              {team?.logoUrl && (
                <Image
                  source={{ uri: team.logoUrl }}
                  style={{ width: 36, height: 36 }}
                  resizeMode="contain"
                />
              )}
              <Text style={[s.value, { flex: 1 }]}>{team?.name ?? 'Choose a team'}</Text>
              <Pressable style={s.button} onPress={() => go('/team-select')}>
                <Text style={[s.link, { color: linkColor }]}>Change Team</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Preferences</Text>
          {data?.preferences ? (
            ACCOUNT_PREFERENCES.map((pref) => (
              <View style={s.preference} key={pref.key}>
                <Feather name="bell" size={18} color="#516b84" />
                <View style={{ flex: 1 }}>
                  <Text style={s.strong}>{pref.label}</Text>
                  <Text style={s.muted}>{pref.description}</Text>
                </View>
                <Switch
                  trackColor={{ false: '#a9b7c5', true: theme.primaryFill }}
                  accessibilityLabel={pref.label}
                  disabled={busy}
                  value={Boolean(data.preferences?.[pref.key])}
                  onValueChange={(value) =>
                    void run(async () => {
                      const result = await accountMutation(
                        authenticatedFetch,
                        '/api/user/preferences',
                        'PATCH',
                        { [pref.key]: value },
                      );
                      setData({ ...data, preferences: result.preferences });
                    })
                  }
                />
              </View>
            ))
          ) : (
            <Text style={s.muted}>{data ? 'Preferences unavailable.' : 'Loading…'}</Text>
          )}
          <Pressable style={s.button} onPress={() => go('/notification-settings')}>
            <Text style={[s.link, { color: linkColor }]}>Manage notification delivery →</Text>
          </Pressable>
        </View>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.heading}>Connected Accounts</Text>
            <Pressable style={s.button} onPress={webSecurity}>
              <Text style={[s.link, { color: linkColor }]}>Manage</Text>
            </Pressable>
          </View>
          {data?.identities ? (
            Array.from(
              new Set([
                ...data.identities.map((i) => i.provider),
                ...Object.keys(data.providers).filter((p) => data.providers[p]),
              ]),
            ).map((provider) => (
              <View style={s.preference} key={provider}>
                <Feather name="link" size={18} color="#00172b" />
                <Text style={[s.strong, { flex: 1, textTransform: 'capitalize' }]}>{provider}</Text>
                <Text style={s.muted}>
                  {data.identities?.some((i) => i.provider === provider)
                    ? 'Connected'
                    : 'Not Connected'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.muted}>{data ? 'Connected accounts unavailable.' : 'Loading…'}</Text>
          )}
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Your Data, Your Control</Text>
          <Text style={s.muted}>Manage your data, account security and privacy settings.</Text>
          <Pressable style={s.button} onPress={webSecurity}>
            <Text style={[s.link, { color: linkColor }]}>Privacy &amp; Security →</Text>
          </Pressable>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Danger Zone</Text>
          <Text style={[s.strong, { color: '#d81934', marginTop: 12 }]}>Delete Account</Text>
          <Text style={s.muted}>Permanently delete your account and associated data.</Text>
          <Pressable
            disabled={busy}
            style={s.button}
            onPress={() =>
              Alert.alert(
                'Permanently delete account?',
                'Your account and associated data will be deleted. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: () =>
                      void run(async () => {
                        await accountMutation(
                          authenticatedFetch,
                          '/api/user/account/delete',
                          'POST',
                          { confirmation: 'DELETE' },
                        );
                        await logout();
                      }),
                  },
                ],
              )
            }
          >
            <Text style={{ color: '#d81934' }}>Delete Account</Text>
          </Pressable>
        </View>
        <Pressable style={s.button} disabled={busy} onPress={() => void logout()}>
          <Text style={[s.link, { color: linkColor }]}>Log out</Text>
        </Pressable>
      </View>
    </PageScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f8fa' },
  hero: { backgroundColor: '#001222', padding: 22 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: {
    fontSize: 32,
    fontStyle: 'italic',
    fontWeight: '900',
    textTransform: 'uppercase',
    color: 'white',
    marginTop: 8,
  },
  intro: { color: '#d5e1ed', lineHeight: 21, fontSize: 14, marginTop: 12 },
  heroPhoto: { alignItems: 'center', gap: 10, marginTop: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  fallback: { backgroundColor: '#e8eef4', alignItems: 'center', justifyContent: 'center' },
  heroButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#a7bacb',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  white: { color: 'white', fontWeight: '700' },
  content: { padding: 12, gap: 14 },
  overview: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#edf1f5',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strong: { fontSize: 13, fontWeight: '800', color: '#00172b' },
  muted: { fontSize: 12, color: '#637f99', marginTop: 4, lineHeight: 18 },
  card: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e8edf2',
    borderRadius: 12,
    padding: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  heading: { fontSize: 16, fontWeight: '800', color: '#00172b' },
  button: { minHeight: 44, padding: 8, justifyContent: 'center' },
  link: { fontSize: 12, fontWeight: '700' },
  field: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#eef2f6' },
  value: { fontSize: 13, color: '#00172b', marginTop: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  preference: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eef2f6',
  },
});
