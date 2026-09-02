import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../components/screen';
import { useAuth } from '../lib/auth-context';
export default function SignIn() {
  const { appleAvailable, googleAvailable, signInWithApple, signInWithGoogle, signInWithEmail, busy, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <SafeAreaView style={s.page}><KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.logo}>DOWN &amp; DISTANCE</Text><Text style={s.tag}>KEEP IT HIGH AND TIGHT</Text>
    <Text style={s.heading}>Your team. Your account.</Text>
    <Text style={s.copy}>Sign in to keep your team, stories, trivia, and rewards in sync.</Text>
    {appleAvailable ? <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12} style={s.apple} onPress={() => void signInWithApple()} /> : null}
    {googleAvailable ? <Pressable style={s.google} disabled={busy} onPress={() => void signInWithGoogle()}>
      <Text style={s.googleMark}>G</Text><Text style={s.googleText}>Continue with Google</Text>
    </Pressable> : null}
    <View style={s.divider}><View style={s.line} /><Text style={s.or}>OR USE YOUR D&amp;D ACCOUNT</Text><View style={s.line} /></View>
    <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Email" placeholderTextColor="#7C8993" />
    <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Password" placeholderTextColor="#7C8993" />
    <Pressable style={[s.emailButton, (!email || !password || busy) && s.disabled]} disabled={!email || !password || busy} onPress={() => void signInWithEmail(email, password)}>
      <Text style={s.emailButtonText}>SIGN IN</Text>
    </Pressable>
    {!appleAvailable && !googleAvailable ? <Text style={s.setup}>Apple and Google require their provider configuration. Email sign-in works with your existing D&amp;D account for local testing.</Text> : null}
    {busy ? <ActivityIndicator color={C.red} style={s.busy} /> : null}
    {error ? <Text style={s.error}>{error}</Text> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream }, content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { color: C.navy, fontWeight: '900', fontStyle: 'italic', fontSize: 27 },
  tag: { color: C.red, letterSpacing: 1.8, fontWeight: '900', fontSize: 12, marginTop: 4 },
  heading: { color: C.ink, fontSize: 38, lineHeight: 41, fontWeight: '900', marginTop: 42 },
  copy: { color: C.muted, fontSize: 17, lineHeight: 25, marginTop: 12, marginBottom: 30 },
  apple: { width: '100%', height: 52 },
  google: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#CFD7DD', backgroundColor: C.white,
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleMark: { color: '#4285F4', fontWeight: '900', fontSize: 20, marginRight: 12 },
  googleText: { color: C.ink, fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: '#D8D4CC' },
  or: { marginHorizontal: 10, color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#CFD7DD', backgroundColor: C.white, paddingHorizontal: 16, color: C.ink, fontSize: 16, marginBottom: 10 },
  emailButton: { height: 52, borderRadius: 12, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  emailButtonText: { color: C.white, fontWeight: '900', letterSpacing: 1 }, disabled: { opacity: 0.5 },
  setup: { color: C.muted, lineHeight: 20, textAlign: 'center', marginTop: 20 }, busy: { marginTop: 18 },
  error: { color: C.red, textAlign: 'center', marginTop: 16, lineHeight: 20 },
});
