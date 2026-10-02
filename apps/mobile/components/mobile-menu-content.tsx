import { useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { PRIMARY_NAV_ITEMS } from '../../../src/config/primary-navigation';
import { TEAM_LIST } from '../../../src/data/teams';
import { useAuth } from '../lib/auth-context';
import { useTeamBranding } from '../lib/team-branding';
import { teamLogoAssets } from '../lib/team-logo-assets';
const routes: Record<string, Href> = {
  huddle: '/wire',
  watch: '/film-room',
  'front-office': '/front-office',
  trivia: '/trivia',
  'parlay-lab': '/parlay-lab',
  merch: '/merch',
};
export function MobileMenuContent({
  close,
  navigate,
}: {
  close: () => void;
  navigate: (href: Href) => void;
}) {
  const { teamId } = useTeamBranding(),
    { user, logout } = useAuth();
  const team = TEAM_LIST.find((t) => t.abbr === teamId);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      close();
    } catch {
      setError('Unable to sign out. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.menu}>MENU</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation menu"
          onPress={close}
          style={s.close}
        >
          <Ionicons name="close" size={24} color="white" />
        </Pressable>
      </View>
      <View style={s.main}>
        <Text style={s.label}>MAIN</Text>
        <View style={{ marginTop: 8 }}>
          {PRIMARY_NAV_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="link"
              onPress={() => navigate(routes[item.id])}
              style={s.link}
            >
              <Text style={s.linkText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.section}>
        <Text style={s.label}>YOUR TEAM</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Change team"
          onPress={() => navigate('/team-select')}
          style={s.identity}
        >
          <View style={s.avatar}>
            <Image
              source={teamLogoAssets[teamId]}
              contentFit="contain"
              style={{ width: 36, height: 36 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{team?.name ?? 'Select your team'}</Text>
            <Text style={s.change}>Change team</Text>
          </View>
        </Pressable>
      </View>
      <View style={s.section}>
        <Text style={s.label}>ACCOUNT</Text>
        <View style={s.identity}>
          <View style={s.avatar}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
            ) : (
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#132A37' }}>
                {(user?.displayName ?? 'Fan')
                  .split(' ')
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join('')}
              </Text>
            )}
          </View>
          <Text style={[s.name, { flex: 1 }]}>{user?.displayName ?? 'Fan'}</Text>
        </View>
        {(
          [
            { label: 'Profile', icon: 'person-outline', href: '/account' },
            { label: 'Settings', icon: 'settings-outline', href: '/account' },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="link"
            style={s.accountLink}
            onPress={() => navigate(item.href)}
          >
            <Ionicons name={item.icon} size={18} color="white" />
            <Text style={s.accountText}>{item.label}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void signOut()}
          style={s.accountLink}
        >
          <Ionicons name="log-out-outline" size={18} color="white" />
          <Text style={s.accountText}>{busy ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
        {!!error && (
          <Text accessibilityRole="alert" style={s.change}>
            {error}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF1A',
  },
  menu: { fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 2.64, color: 'white' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FFFFFF26',
    backgroundColor: '#FFFFFF1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { paddingVertical: 20 },
  label: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 2.4,
    color: '#FFFFFF73',
  },
  link: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF1A' },
  linkText: { fontSize: 18, lineHeight: 28, fontWeight: '900', color: 'white' },
  section: { paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#FFFFFF1A' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '900', color: 'white' },
  change: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: 'white' },
  accountLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 44 },
  accountText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: 'white' },
});
