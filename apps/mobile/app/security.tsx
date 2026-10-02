import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PageScrollView } from '../components/page-scroll-view';
import { PageHeading } from '../components/page-heading';
import { authenticatedFetch } from '../lib/auth';
import { useAuth } from '../lib/auth-context';
import { accountMutation } from '../../../packages/account/model';

type Session = {
  id: string;
  userAgent: string | null;
  lastUsedAt: string;
  revokedAt: string | null;
};
type Identity = { id: string; provider: string; providerEmail?: string | null };
export default function Security() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const load = useCallback(async () => {
    const [s, i] = await Promise.all([
      authenticatedFetch('/api/auth/sessions'),
      authenticatedFetch('/api/auth/identities'),
    ]);
    if (!s.ok || !i.ok) throw new Error('Unable to load account security.');
    setSessions((await s.json()).sessions);
    setIdentities((await i.json()).identities);
  }, []);
  useEffect(() => {
    void load()
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to update your account.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageScrollView
      style={s.page}
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeading
        eyebrow="MY ACCOUNT"
        title="Security"
        description="Password, sessions, and account access."
      />
      {loading && <ActivityIndicator />}
      {!!message && (
        <Text accessibilityRole="alert" style={s.message}>
          {message}
        </Text>
      )}
      <Text style={s.heading}>Connected accounts</Text>
      {identities.map((identity) => (
        <View key={identity.id} style={s.row}>
          <View style={s.grow}>
            <Text style={s.title}>{identity.provider}</Text>
            <Text style={s.copy}>{identity.providerEmail ?? 'No email shared'}</Text>
          </View>
          <Pressable
            disabled={busy || identities.length <= 1}
            style={s.button}
            onPress={() =>
              Alert.alert('Unlink account?', `Remove ${identity.provider} as a sign-in method?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Unlink',
                  style: 'destructive',
                  onPress: () =>
                    void run(async () => {
                      await accountMutation(
                        authenticatedFetch,
                        `/api/auth/identities/${identity.id}`,
                        'DELETE',
                      );
                      await load();
                    }),
                },
              ])
            }
          >
            <Text style={[s.action, identities.length <= 1 && s.disabled]}>Unlink</Text>
          </Pressable>
        </View>
      ))}
      {identities.some((i) => i.provider.toLowerCase() === 'email') && (
        <View style={s.section}>
          <Text style={s.heading}>Change password</Text>
          <TextInput
            accessibilityLabel="Current password"
            placeholder="Current password"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            style={s.input}
          />
          <TextInput
            accessibilityLabel="New password"
            placeholder="New password (at least 10 characters)"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={s.input}
          />
          <Pressable
            disabled={busy || !currentPassword || newPassword.length < 10}
            style={s.pill}
            onPress={() =>
              void run(async () => {
                await accountMutation(authenticatedFetch, '/api/auth/change-password', 'POST', {
                  currentPassword,
                  newPassword,
                });
                await logout();
              })
            }
          >
            <Text style={s.title}>Update password</Text>
          </Pressable>
        </View>
      )}
      <View style={s.section}>
        <Text style={s.heading}>Active sessions</Text>
        <Pressable
          disabled={busy}
          style={s.button}
          onPress={() =>
            Alert.alert('Sign out everywhere?', 'All active sessions will be revoked.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Revoke all',
                onPress: () =>
                  void run(async () => {
                    await accountMutation(authenticatedFetch, '/api/auth/sessions', 'DELETE');
                    await logout();
                  }),
              },
            ])
          }
        >
          <Text style={s.action}>Revoke all</Text>
        </Pressable>
      </View>
      {sessions
        .filter((session) => !session.revokedAt)
        .map((session) => (
          <View key={session.id} style={s.row}>
            <View style={s.grow}>
              <Text style={s.title}>{session.userAgent ?? 'Unknown device'}</Text>
              <Text style={s.copy}>Last used {new Date(session.lastUsedAt).toLocaleString()}</Text>
            </View>
            <Pressable
              disabled={busy}
              style={s.button}
              onPress={() =>
                void run(async () => {
                  await accountMutation(
                    authenticatedFetch,
                    `/api/auth/sessions/${session.id}`,
                    'DELETE',
                  );
                  await load();
                })
              }
            >
              <Text style={s.action}>Revoke</Text>
            </Pressable>
          </View>
        ))}
      <View style={s.section}>
        <Text style={s.heading}>Your data</Text>
        <Text style={s.copy}>Export your account data to a destination you choose.</Text>
        <Pressable
          disabled={busy}
          style={s.pill}
          onPress={() =>
            void run(async () => {
              const response = await authenticatedFetch('/api/user/export');
              if (!response.ok) throw new Error('Unable to export account data.');
              await Share.share({
                title: 'Down & Distance account data',
                message: JSON.stringify(await response.json(), null, 2),
              });
            })
          }
        >
          <Text style={s.title}>Export my data</Text>
        </Pressable>
      </View>
      <Pressable disabled={busy} style={s.pill} onPress={() => void logout()}>
        <Text style={s.action}>Log out of this device</Text>
      </Pressable>
    </PageScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'white' },
  body: { padding: 24, paddingBottom: 40 },
  heading: { fontSize: 18, fontWeight: '900', color: '#00172B', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '800', color: '#00172B' },
  copy: { fontSize: 12, lineHeight: 20, color: '#66788C', marginTop: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#00172B1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  grow: { flex: 1 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  action: { color: '#C71F36', fontSize: 12, fontWeight: '800' },
  section: { marginTop: 32, borderTopWidth: 1, borderColor: '#00172B1A', paddingTop: 24 },
  pill: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#00172B26',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 16,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#00172B26',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    color: '#00172B',
  },
  message: { color: '#B42318', marginVertical: 12 },
  disabled: { opacity: 0.35 },
});
