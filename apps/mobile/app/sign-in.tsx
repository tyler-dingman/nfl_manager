import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { TeamBrandedLogo } from '../components/team-branded-logo';
import { API_BASE_URL, apiFetch } from '../lib/network';
import { DEFAULT_TEAM_BRAND_THEME as brand } from '../../../src/lib/team-brand-themes';

type Mode = 'welcome' | 'login' | 'signup' | 'reset';
export default function SignIn() {
  const auth = useAuth();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const socialCount = Number(auth.appleAvailable) + Number(auth.googleAvailable);
  const welcomeHeadingSize = Math.min(70, Math.max(36, (height - insets.top - insets.bottom - 410 - socialCount * 58) / 3));
  const [mode, setMode] = useState<Mode | null>('welcome');
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const transitioning = useRef(false);
  useEffect(() => {
    transitioning.current = false;
    if (!mode) return;
    welcomeFade.setValue(0);
    const animation = Animated.timing(welcomeFade, { toValue: 1, duration: mode === 'welcome' ? 450 : 300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [mode, welcomeFade]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const busy = working || auth.busy;
  const navigate = (next: Mode) => {
    if (transitioning.current || next === mode) return;
    transitioning.current = true;
    Animated.timing(welcomeFade, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setFormError(''); setMessage(''); setMode(next); }
      else transitioning.current = false;
    });
  };
  const submit = async () => {
    setFormError(''); setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFormError('Enter a valid email address.'); return; }
    if (mode !== 'reset' && !password) { setFormError('Enter your password.'); return; }
    if (mode === 'signup' && (password.length < 10 || password.length > 256)) { setFormError('Use a password between 10 and 256 characters.'); return; }
    if (mode === 'login') { await auth.signInWithEmail(email.trim(), password); return; }
    setWorking(true);
    try {
      const result = await apiFetch(mode === 'reset' ? '/api/auth/forgot-password' : '/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'reset' ? { email: email.trim() } : { email: email.trim(), password, displayName: displayName.trim() }),
      });
      const body = await result.json();
      if (!result.ok || !body.ok) throw new Error(body.error ?? 'Unable to continue. Please try again.');
      if (mode === 'reset') setMessage('If an account exists, a reset link will be sent.');
      else { setMessage('Account created. Signing you in…'); await auth.signInWithEmail(email.trim(), password); }
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to connect. Please try again.'); }
    finally { setWorking(false); }
  };
  const socials = <>
    {(auth.appleAvailable || auth.googleAvailable) && <View style={[s.divider, mode === 'welcome' && { marginVertical: 10 }]}><View style={s.line}/><Text style={s.or}>OR CONTINUE WITH</Text><View style={s.line}/></View>}
    {auth.appleAvailable && (Platform.OS === 'ios' ? <View pointerEvents={busy ? 'none' : 'auto'}><AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE} cornerRadius={12} style={{ height: 48, width: '100%', marginBottom: 10 }} onPress={() => void auth.signInWithApple()} /></View> : <Pressable accessibilityRole="button" disabled={busy} style={s.social} onPress={() => void auth.signInWithApple()}><Ionicons name="logo-apple" size={22} color="white"/><Text style={s.buttonText}>Continue with Apple</Text></Pressable>)}
    {auth.googleAvailable && <Pressable accessibilityRole="button" disabled={busy} style={s.social} onPress={() => void auth.signInWithGoogle()}><Ionicons name="logo-google" size={22} color="white"/><Text style={s.buttonText}>Continue with Google</Text></Pressable>}
  </>;
  return <SafeAreaView style={s.page}>
    {!mode ? <View style={s.loading}><TeamBrandedLogo letteringColor="#FFFFFF" style={{ width: 200, height: 104 }}/><ActivityIndicator color={brand.primary}/></View> : <Animated.View style={{ flex: 1, opacity: welcomeFade }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[s.content, mode === 'welcome' && { paddingTop: 16, paddingBottom: 16 }]}>
        <View pointerEvents="none" style={s.stripe}/>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', flexGrow: 1 }}>
          {mode !== 'welcome' && <Pressable accessibilityRole="button" accessibilityLabel="Back to welcome" onPress={() => navigate('welcome')} style={s.back}><Ionicons name="arrow-back" size={24} color="#FFFFFF"/></Pressable>}
          <TeamBrandedLogo letteringColor="#FFFFFF" style={[s.logo, mode === 'welcome' && { height: 56, width: 112, marginTop: 0, marginBottom: 8 }, mode !== 'welcome' && { alignSelf: 'center' }]}/>
          <Text accessibilityRole="header" style={[s.heading, mode === 'welcome' && { fontSize: welcomeHeadingSize, lineHeight: welcomeHeadingSize, color: '#FFFFFF' }, mode === 'login' && { color: '#FFFFFF' }]}>{mode === 'welcome' ? 'WELCOME TO\nDOWN &\nDISTANCE.' : mode === 'signup' ? 'SIGN UP' : mode === 'reset' ? 'RESET PASSWORD' : 'LOG IN'}</Text>
          <Text style={[s.copy, mode === 'welcome' && { color: brand.light, marginBottom: 12 }]}>{mode === 'welcome' ? 'Your team. Your stories.\nYour game. All in one place.' : mode === 'signup' ? 'Your team. Your game. Create your account.' : mode === 'reset' ? 'Enter your email and we’ll help you get back in the game.' : "Welcome back. Let’s get you in the game."}</Text>
          {mode === 'welcome' ? <View style={{ marginTop: 8 }}><Pressable accessibilityRole="button" style={s.primary} onPress={() => navigate('login')}><Text style={s.buttonText}>Log In</Text></Pressable><Pressable accessibilityRole="button" style={s.secondary} onPress={() => navigate('signup')}><Text style={s.buttonText}>Sign Up</Text></Pressable>{socials}</View> : <>
            {mode === 'signup' && <View style={s.field}><Ionicons name="person-outline" size={20} color={brand.light}/><TextInput accessibilityLabel="Display name" placeholder="Display name" placeholderTextColor="#99a6ac" maxLength={100} value={displayName} onChangeText={setDisplayName} autoComplete="name" textContentType="name" style={s.input}/></View>}
            <View style={s.field}><Ionicons name="mail-outline" size={20} color={brand.light}/><TextInput accessibilityLabel="Email" placeholder="Email" placeholderTextColor="#99a6ac" maxLength={320} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" style={s.input}/></View>
            {mode !== 'reset' && <View style={s.field}><Ionicons name="lock-closed-outline" size={20} color={brand.light}/><TextInput accessibilityLabel="Password" placeholder="Password" placeholderTextColor="#99a6ac" maxLength={256} value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} returnKeyType="go" onSubmitEditing={() => { if (!busy) void submit(); }} style={s.input}/><Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(!visible)} style={{ padding: 8 }}><Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color={brand.light}/></Pressable></View>}
            {mode === 'login' && <Pressable accessibilityRole="button" onPress={() => navigate('reset')} style={{ alignSelf: 'flex-end', paddingVertical: 14 }}><Text style={s.link}>Forgot password?</Text></Pressable>}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={[s.primary, busy && { opacity: 0.5 }]}><Text style={s.buttonText}>{mode === 'signup' ? 'Sign Up' : mode === 'reset' ? 'Send Reset Link' : 'Log In'}</Text></Pressable>
            {mode !== 'reset' && socials}
            {mode !== 'reset' && <Pressable accessibilityRole="button" onPress={() => navigate(mode === 'signup' ? 'login' : 'signup')} style={{ paddingVertical: 20 }}><Text style={s.footer}>{mode === 'signup' ? 'Already have an account? ' : "Don’t have an account? "}<Text style={s.link}>{mode === 'signup' ? 'Log in' : 'Sign up'}</Text></Text></Pressable>}
          </>}
          {busy && <ActivityIndicator color={brand.primary} style={{ marginTop: 12 }}/>}
          {(formError || auth.error) && <Text accessibilityRole="alert" style={s.error}>{formError || auth.error}</Text>}
          {!!message && <Text accessibilityLiveRegion="polite" style={s.copy}>{message}</Text>}
          <Text style={[s.footer, { marginTop: mode === 'welcome' ? 16 : 24 }]}>By continuing, you agree to our <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${API_BASE_URL}/terms`)} style={s.link}>Terms</Text> and <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)} style={s.link}>Privacy Policy</Text>.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView></Animated.View>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#001016' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 32, overflow: 'hidden' },
  stripe: { position: 'absolute', width: 40, height: 650, top: 0, right: 30, backgroundColor: brand.primary, opacity: 0.08, transform: [{ rotate: '28deg' }] },
  logo: { width: 148, height: 80, marginTop: 28, marginBottom: 16 }, back: { paddingVertical: 8, alignSelf: 'flex-start' },
  heading: { color: brand.light, fontFamily: 'BarlowCondensedItalic', fontSize: 52, lineHeight: 52, marginBottom: 14 },
  copy: { color: '#f5f1eb', fontSize: 16, lineHeight: 25, marginBottom: 22 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  secondary: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: brand.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: '#fff5e8', fontWeight: '700', fontSize: 17 },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#3b4b52', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 4, backgroundColor: '#06171e', marginBottom: 12 },
  input: { flex: 1, minWidth: 0, color: '#fff5e8', fontSize: 16, minHeight: 50, paddingHorizontal: 8, paddingVertical: 12 },
  link: { color: brand.primary, fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 }, line: { flex: 1, height: 1, backgroundColor: '#3b4b52' }, or: { fontSize: 9, color: '#aab4b8', letterSpacing: 1.5 },
  social: { minHeight: 48, borderWidth: 1, borderColor: '#3b4b52', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 },
  footer: { color: '#bac4c8', textAlign: 'center', fontSize: 12, lineHeight: 20 },
  error: { color: '#ffb4ac', backgroundColor: '#361b20', borderRadius: 10, padding: 12, marginTop: 14, lineHeight: 22 },
});
