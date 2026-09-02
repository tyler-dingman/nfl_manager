import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getUserProfile, updateUserProfile } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function Profile() {
  const { refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getUserProfile()
      .then((profile) => {
        setDisplayName(profile.displayName);
        setEmail(profile.primaryEmail ?? '');
      })
      .catch((caught) => setMessage(caught instanceof Error ? caught.message : 'Profile is unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!displayName.trim()) return setMessage('Enter a display name.');
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile({ displayName: displayName.trim() });
      await refreshUser();
      setMessage('Profile saved.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.loading}><ActivityIndicator color={C.red} /></View>;
  return (
    <View style={s.page}>
      <Eyebrow>CANONICAL D&D ACCOUNT</Eyebrow>
      <Heading>Profile</Heading>
      <Text style={s.label}>DISPLAY NAME</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} autoCapitalize="words" style={s.input} />
      <Text style={s.label}>EMAIL</Text>
      <View style={s.readOnly}><Text style={s.readOnlyText}>{email || 'No email on file'}</Text></View>
      <Text style={s.help}>Email and linked sign-in methods are managed by your D&D account.</Text>
      {message ? <Text style={s.message}>{message}</Text> : null}
      <Pressable disabled={saving} onPress={() => void save()} style={s.button}>
        <Text style={s.buttonText}>{saving ? 'SAVING…' : 'SAVE PROFILE'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: C.cream, justifyContent: 'center' },
  page: { flex: 1, backgroundColor: C.cream, padding: 20 },
  label: { color: C.ink, fontSize: 13, fontWeight: '900', letterSpacing: 1.2, marginTop: 24, marginBottom: 8 },
  input: { backgroundColor: C.white, color: C.ink, borderRadius: 14, padding: 16, fontSize: 16 },
  readOnly: { backgroundColor: '#E9E5DC', borderRadius: 14, padding: 16 },
  readOnlyText: { color: C.muted },
  help: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  message: { color: C.ink, marginTop: 18 },
  button: { backgroundColor: C.red, borderRadius: 14, alignItems: 'center', padding: 16, marginTop: 22 },
  buttonText: { color: C.white, fontWeight: '900', letterSpacing: 1 },
});
