import { PageHeading, PageState } from '../components/page-heading';
import { Image } from 'react-native';
import { Screen } from '../components/screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getUserProfile, updateUserProfile } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function Profile() {
  const { refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setMessage(null);
    void getUserProfile()
      .then((profile) => {
        setLoaded(true);
        setDisplayName(profile.displayName);
        setEmail(profile.primaryEmail ?? '');
        setAvatarUrl(profile.avatarUrl ?? '');
      })
      .catch((caught) =>
        setMessage(caught instanceof Error ? caught.message : 'Profile is unavailable.'),
      )
      .finally(() => setLoading(false));
  }, [attempt]);

  const save = async () => {
    if (!loaded || saving) return;
    if (!displayName.trim()) return setMessage('Enter a display name.');
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });
      await refreshUser();
      setMessage('Profile saved.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.red} />
      </View>
    );
  if (!loaded)
    return (
      <Screen>
        <PageState title="Profile unavailable" message={message ?? undefined} />
        <Pressable style={s.button} onPress={() => setAttempt((x) => x + 1)}>
          <Text style={s.buttonText}>TRY AGAIN</Text>
        </Pressable>
      </Screen>
    );
  return (
    <Screen>
      <View style={s.page}>
        <PageHeading
          dark
          eyebrow="MY ACCOUNT"
          title="Profile Information"
          description="Manage your account, preferences, and how you appear across Down & Distance."
        />
        <View style={s.identity}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.initials}>{displayName.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.identityName}>{displayName}</Text>
        </View>
        <Text style={s.label}>DISPLAY NAME</Text>
        <TextInput
          accessibilityLabel="Display name"
          maxLength={100}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          style={s.input}
        />
        <Text style={s.label}>PROFILE PHOTO URL</Text>
        <TextInput
          accessibilityLabel="Profile photo URL"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          autoCapitalize="none"
          keyboardType="url"
          style={s.input}
        />
        <Text style={s.help}>Use an image URL, or leave blank to remove your photo.</Text>
        <Text style={s.label}>EMAIL</Text>
        <View style={s.readOnly}>
          <Text style={s.readOnlyText}>{email || 'No email on file'}</Text>
        </View>
        <Text style={s.help}>
          Email and linked sign-in methods are managed by your D&D account.
        </Text>
        {message ? <Text style={s.message}>{message}</Text> : null}
        <Pressable disabled={saving} onPress={() => void save()} style={s.button}>
          <Text style={s.buttonText}>{saving ? 'SAVING…' : 'SAVE PROFILE'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  identity: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DCE7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 28, fontWeight: '800', color: C.ink },
  identityName: { fontSize: 20, fontWeight: '800', color: C.ink },
  loading: { flex: 1, backgroundColor: '#F7F8FA', justifyContent: 'center' },
  page: { flex: 1, backgroundColor: '#F7F8FA', padding: 20 },
  label: {
    color: C.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 8,
  },
  input: { backgroundColor: C.white, color: C.ink, borderRadius: 8, padding: 16, fontSize: 16 },
  readOnly: { backgroundColor: '#E9E5DC', borderRadius: 8, padding: 16 },
  readOnlyText: { color: C.muted },
  help: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  message: { color: C.ink, marginTop: 18 },
  button: {
    backgroundColor: C.red,
    borderRadius: 8,
    alignItems: 'center',
    padding: 16,
    marginTop: 22,
  },
  buttonText: { color: C.white, fontWeight: '900', letterSpacing: 1 },
});
