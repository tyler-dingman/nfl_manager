import { useEffect, useState, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { gameDayHeroAsset } from '../../../src/config/game-day-hero';
import { getOnboardingTheme } from '../lib/onboarding-theme';
import { API_BASE_URL } from '../lib/network';
import { TEAM_LIST } from '../../../src/data/teams';
import { DEFAULT_TEAM_BRAND_THEME as brand } from '../../../src/lib/team-brand-themes';
import {
  DEFAULT_DELIVERY_TIME,
  DELIVERY_PRESETS,
  deviceTimezone,
  validDeliveryTime,
} from '../../../packages/three-and-out/schedule';
import { teamLogoAssets } from '../lib/team-logo-assets';
import { useTeam } from '../lib/team-context';
import { enablePush } from '../lib/push';
import {
  onboardingRequest,
  saveDelivery,
  saveOnboardingStep,
  type Delivery,
} from '../lib/onboarding';

export function PersonalizationOnboarding({
  initial,
  onComplete,
}: {
  initial: { step: number; team: string; delivery: Delivery; established: boolean };
  onComplete: (reduceMotion: boolean) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  const { setPrimaryTeam } = useTeam();
  const [step, setStep] = useState(initial.step);
  const [selected, setSelected] = useState(initial.team);
  const [delivery, setDelivery] = useState<Delivery>({
    ...initial.delivery,
    deliveryTime: initial.delivery?.deliveryTime ?? DEFAULT_DELIVERY_TIME,
    timezone: initial.delivery?.timezone ?? deviceTimezone(),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [email, setEmail] = useState('');
  const team = TEAM_LIST.find((t) => t.abbr === selected);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    fade.setValue(reduceMotion ? 1 : 0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: reduceMotion ? 0 : 350,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, reduceMotion, fade]);
  const nickname = team?.name.replace(`${team.city} `, '') ?? 'your team';
  const onboarding = getOnboardingTheme(selected);
  const accent = onboarding.accent;
  const selectedCard = { borderColor: onboarding.selectedBorder, backgroundColor: onboarding.selectedBackground };
  const scheduled = delivery.enabled && (delivery.push || delivery.email || delivery.sms);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const advance = async (next: number) => {
    await saveOnboardingStep(next);
    setStep(next);
  };
  const back = () => {
    if (busy || step === 1) return;
    void run(() => advance(step === 5 && !scheduled ? 3 : step - 1));
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [step, busy, scheduled]);
  const chooseTeam = (id: string) =>
    void run(async () => {
      await setPrimaryTeam(id);
      setSelected(id);
      await advance(initial.established ? 5 : 2);
    });
  const toggle = (channel: 'push' | 'email') =>
    void run(async () => {
      const on = !(delivery.enabled && delivery[channel]);
      if (channel === 'push' && on) await enablePush();
      const next = {
        ...delivery,
        ...(delivery.enabled ? {} : { push: false, email: false, sms: false }),
        [channel]: on,
      };
      next.enabled = next.push || next.email || next.sms;
      setDelivery(await saveDelivery(next));
    });
  const finish = async () => {
    if (!selected) throw new Error('Choose a team before finishing.');
    await saveOnboardingStep(5, true);
    await new Promise<void>((resolve) => {
      Animated.timing(fade, {
        toValue: 0,
        duration: reduceMotion ? 0 : 200,
        useNativeDriver: true,
      }).start(() => resolve());
    });
    onComplete(reduceMotion);
  };
  const next = () =>
    void run(async () => {
      if (step === 1) {
        if (!selected) throw new Error('Select your favorite team.');
        await setPrimaryTeam(selected);
        await advance(initial.established ? 5 : 2);
      } else if (step === 2) await advance(3);
      else if (step === 3) await advance(scheduled ? 4 : 5);
      else if (step === 4) {
        if (!validDeliveryTime(delivery.deliveryTime)) throw new Error('Choose a valid time.');
        setDelivery(await saveDelivery(delivery));
        await advance(5);
      } else {
        await finish();
      }
    });
  const skip = () =>
    void run(async () => {
      if (step === 3)
        setDelivery(
          await saveDelivery({
            ...delivery,
            enabled: false,
            push: false,
            email: false,
            sms: false,
          }),
        );
      else
        setDelivery(
          await saveDelivery({
            ...delivery,
            deliveryTime: initial.delivery?.deliveryTime ?? DEFAULT_DELIVERY_TIME,
          }),
        );
      await finish();
    });
  return (
    <SafeAreaView style={s.page}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 25,
          top: 180,
          width: 45,
          height: 650,
          backgroundColor: step > 1 ? accent : brand.primary,
          opacity: 0.12,
          transform: [{ rotate: '28deg' }],
        }}
      />
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {(step === 2 || step === 5) && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={selected === 'KC'
            ? require('../../../public/images/gameday/stadium/kc/gameday.png')
            : { uri: API_BASE_URL + gameDayHeroAsset(selected) }}
            style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,16,22,0.84)' }]} />
        </View>}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView ref={scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <View style={s.top}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous onboarding step"
                disabled={step === 1 || busy}
                onPress={back}
                style={{ width: 44, height: 44, justifyContent: 'center' }}
              >
                {step > 1 && <Ionicons name="arrow-back" size={22} color="#FFFFFF" />}
              </Pressable>
              <View
                accessibilityLabel={`Setup step ${step} of 5`}
                style={{ flexDirection: 'row', gap: 8 }}
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: i <= step ? (step > 1 ? onboarding.progress : brand.primary) : '#35434a',
                    }}
                  />
                ))}
              </View>
              <View style={{ width: 44 }} />
            </View>
            {step === 1 ? (
              <>
                <Text style={s.heading} numberOfLines={1} adjustsFontSizeToFit>WHAT’S YOUR TEAM?</Text>
                <Text style={s.copy}>
                  Tell us your favorite team so we can personalize your experience.
                </Text>
                <View style={s.grid}>
                  {TEAM_LIST.map((t) => (
                    <Pressable
                      key={t.abbr}
                      accessibilityRole="button"
                      accessibilityLabel={t.name}
                      accessibilityState={{ selected: selected === t.abbr }}
                      disabled={busy}
                      onPress={() => chooseTeam(t.abbr)}
                      style={[
                        s.team,
                        selected === t.abbr && { borderColor: brand.primary, borderWidth: 2 },
                      ]}
                    >
                      <Image
                        source={teamLogoAssets[t.abbr]}
                        style={{ width: 52, height: 42 }}
                        contentFit="contain"
                      />
                      <Text style={s.teamName}>{t.name.replace(`${t.city} `, '')}</Text>
                      {selected === t.abbr && (
                        <Ionicons name="checkmark-circle" color={brand.primary} size={18} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </>
            ) : step === 2 ? (
              <>
                <Text style={s.valueEyebrow}>YOUR TEAM</Text>
                <View style={s.identity}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.city}>{team?.city.toUpperCase()}</Text>
                    <Text style={s.nickname} numberOfLines={1} adjustsFontSizeToFit>{nickname.toUpperCase()}</Text>
                    <View style={{ width: 30, height: 3, backgroundColor: accent, marginVertical: 8 }} />
                  </View>
                  <Image source={teamLogoAssets[selected]} style={s.identityLogo} contentFit="contain" />
                </View>
                <Text style={[s.valueEyebrow, { marginBottom: 22 }]}>NEWS / ANALYSIS / COMMUNITY</Text>
                <Text style={[s.heading, { marginBottom: 0 }]} adjustsFontSizeToFit numberOfLines={1}>ALL THINGS {nickname.toUpperCase()}.</Text>
                <Text style={[s.heading, { color: accent }]} adjustsFontSizeToFit numberOfLines={1}>ALL IN ONE PLACE.</Text>
                <Text style={s.copy}>
                  Down &amp; Distance keeps you caught up on the {nickname}, your way.
                  {' '}News, updates, video and analysis — personalized around your team.
                </Text>
                <View style={s.features}>
                  {([
                    ['newspaper-outline', 'THE BEAT', `Top stories, analysis and everything ${nickname}.`],
                    ['play-circle-outline', 'FILM ROOM', 'Watch, learn and break it down.'],
                    ['flask-outline', 'PARLAY LAB', 'Stats, props and insights built for fans.'],
                    ['people-outline', 'THE HUDDLE', `Join the conversation with other ${nickname} fans.`],
                  ] as const).map(([icon, title, copy]) => <View key={title} style={s.feature}>
                    <Ionicons name={icon} color={accent} size={28} />
                    <View style={{ flex: 1 }}><Text style={s.featureTitle}>{title}</Text>
                      <Text style={s.featureCopy}>{copy}</Text></View>
                  </View>)}
                </View>
              </>
            ) : step === 3 ? (
              <>
                <Text style={s.heading}>STAY IN THE KNOW</Text>
                <Text style={s.copy}>Choose how you want to get your {nickname} updates.</Text>
                {(['push', 'email', 'sms'] as const).map((channel) => {
                  const checked = delivery.enabled && delivery[channel];
                  const unavailable =
                    channel === 'sms' || (channel === 'email' && !delivery.emailAvailable);
                  return (
                    <Pressable
                      key={channel}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked, disabled: unavailable || busy }}
                      disabled={unavailable || busy}
                      onPress={() => {
                        if (channel !== 'sms') toggle(channel);
                      }}
                      style={[s.card, s.row, checked && selectedCard]}
                    >
                      <Ionicons
                        name={
                          channel === 'push'
                            ? 'notifications-outline'
                            : channel === 'email'
                              ? 'mail-outline'
                              : 'chatbubble-outline'
                        }
                        size={25}
                        color={onboarding.icon}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>
                          {channel === 'push'
                            ? 'Push Notifications'
                            : channel === 'email'
                              ? 'Email Updates'
                              : 'Text Messages'}
                        </Text>
                        <Text style={s.small}>
                          {channel === 'push'
                            ? 'Get Three & Out and important team updates on your device.'
                            : channel === 'email'
                              ? `${delivery.accountEmail ?? 'Add an account email below.'} · Daily email delivery is not available yet; save your preference.`
                              : 'SMS delivery and phone verification are not available yet.'}
                        </Text>
                      </View>
                      <Ionicons
                        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={checked ? onboarding.icon : '#63747e'}
                      />
                    </Pressable>
                  );
                })}
                {!delivery.emailAvailable && (
                  <>
                    <TextInput
                      accessibilityLabel="Account email"
                      placeholder="Email address"
                      placeholderTextColor="#99a6ac"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={s.input}
                    />
                    <Pressable
                      style={s.card}
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await onboardingRequest('/api/user/email-change/request', 'POST', {
                            email,
                          });
                          setError('Check your email to confirm, then tap Refresh email.');
                        })
                      }
                    >
                      <Text style={s.label}>Confirm account email</Text>
                    </Pressable>
                    <Pressable
                      style={s.card}
                      onPress={() =>
                        void run(async () => {
                          const body = await onboardingRequest('/api/three-and-out/preferences');
                          setDelivery(body.preferences);
                        })
                      }
                    >
                      <Text style={s.label}>Refresh email</Text>
                    </Pressable>
                  </>
                )}
                <Text style={s.small}>
                  Push denied? You can enable it later in device Settings. Delivery choices can be
                  changed in Account → Notifications.
                </Text>
              </>
            ) : step === 4 ? (
              <>
                <Text style={s.heading}>WHEN DO YOU WANT{'\n'}YOUR UPDATES?</Text>
                <Text style={s.copy}>Pick a time for your daily Three &amp; Out.</Text>
                <Text style={s.small}>{delivery.timezone} · local time</Text>
                {DELIVERY_PRESETS.map((p) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected:
                        p.id === 'custom'
                          ? !DELIVERY_PRESETS.some(
                              (preset) => preset.time === delivery.deliveryTime,
                            )
                          : p.time === delivery.deliveryTime,
                    }}
                    key={p.id}
                    onPress={() =>
                      p.id === 'custom'
                        ? setPicker(true)
                        : setDelivery({ ...delivery, deliveryTime: p.time })
                    }
                    style={[
                      s.card,
                      s.row,
                      (p.id === 'custom'
                        ? !DELIVERY_PRESETS.some((preset) => preset.time === delivery.deliveryTime)
                        : p.time === delivery.deliveryTime) && selectedCard,
                    ]}
                  >
                    <Text style={[s.label, { flex: 1 }]}>{p.label}</Text>
                    <Text style={s.small}>{p.time || delivery.deliveryTime}</Text>
                    <Ionicons
                      name={
                        (
                          p.id === 'custom'
                            ? !DELIVERY_PRESETS.some(
                                (preset) => preset.time === delivery.deliveryTime,
                              )
                            : p.time === delivery.deliveryTime
                        )
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      color={(p.id === 'custom' ? !DELIVERY_PRESETS.some((preset) => preset.time === delivery.deliveryTime) : p.time === delivery.deliveryTime) ? onboarding.icon : '#63747e'}
                      size={22}
                    />
                  </Pressable>
                ))}
                {picker &&
                  (Platform.OS === 'web' ? (
                    <TextInput
                      accessibilityLabel="Custom time HH:MM"
                      value={delivery.deliveryTime}
                      onChangeText={(deliveryTime) => setDelivery({ ...delivery, deliveryTime })}
                      style={[s.input, { borderColor: onboarding.selectedBorder }]}
                    />
                  ) : (
                    <DateTimePicker
                      mode="time"
                      themeVariant="dark"
                      accentColor={onboarding.accent}
                      value={
                        new Date(
                          `2000-01-01T${validDeliveryTime(delivery.deliveryTime) ? delivery.deliveryTime : DEFAULT_DELIVERY_TIME}:00`,
                        )
                      }
                      onChange={(_, date) => {
                        if (Platform.OS === 'android') setPicker(false);
                        if (date)
                          setDelivery({
                            ...delivery,
                            deliveryTime: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
                          });
                      }}
                    />
                  ))}
              </>
            ) : (
              <>
                <Image source={teamLogoAssets[selected]} style={s.logo} contentFit="contain" />
                <Text style={[s.valueEyebrow, { color: accent }]}>{team?.name.toUpperCase()}</Text>
                <Text style={s.heading}>YOU’RE ALL SET!</Text>
                <Text style={s.copy}>You’re ready for your {nickname} experience.</Text>
                <Text style={s.copy}>
                  Your personalized {nickname} news, video and daily Three &amp; Out are ready in
                  the app.
                </Text>
                <Text style={s.copy}>
                  {delivery.enabled && delivery.push
                    ? `Push updates are scheduled for ${delivery.deliveryTime} (${delivery.timezone}).`
                    : 'You can set up daily push updates in Account → Notifications.'}
                </Text>
                <Text style={s.copy}>Let’s make this a great season.</Text>
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {step !== 1 && <Pressable
              accessibilityLabel={busy ? 'Saving…' : step === 5 ? 'Go to My Team' : 'Continue'}
              accessibilityRole="button"
              disabled={busy}
              onPress={next}
              style={[s.button, { backgroundColor: onboarding.primaryCTA, flexDirection: 'row', gap: 12 }, busy && { opacity: 0.5 }]}
            >
              <Text style={[s.buttonText, { color: onboarding.onPrimary }]}>
                {busy ? 'Saving…' : step === 5 ? 'Go to My Team' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={22} color={onboarding.onPrimary} />
            </Pressable>}
            {(step === 3 || step === 4) && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={skip}
                style={{ padding: 20 }}
              >
                <Text style={{ color: onboarding.link, textAlign: 'center' }}>
                  {step === 4
                    ? `Use saved time (${initial.delivery?.deliveryTime ?? DEFAULT_DELIVERY_TIME})`
                    : 'Maybe later'}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  valueEyebrow: { color: '#829ca7', fontFamily: 'BarlowCondensed', fontSize: 12, letterSpacing: 3, marginBottom: 10 },
  identity: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  city: { color: '#FFFFFF', fontFamily: 'BarlowCondensed', fontSize: 16, letterSpacing: 4 },
  nickname: { color: '#FFFFFF', fontFamily: 'BarlowCondensedItalic', fontSize: 66, lineHeight: 72 },
  identityLogo: { width: '36%', height: 110, marginLeft: 8 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  feature: { width: '48%', flexGrow: 1, flexDirection: 'row', gap: 10, padding: 12, borderWidth: 1, borderColor: '#294750', borderRadius: 10, backgroundColor: 'rgba(6,26,34,0.75)' },
  featureTitle: { color: '#FFFFFF', fontFamily: 'BarlowCondensed', fontSize: 16, marginBottom: 4 },
  featureCopy: { color: '#a7bdc7', fontSize: 12, lineHeight: 17 },
  page: { flex: 1, overflow: 'hidden', backgroundColor: '#001016' },
  body: { padding: 24, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heading: {
    fontFamily: 'BarlowCondensedItalic',
    fontSize: 38,
    lineHeight: 40,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  copy: { fontSize: 16, lineHeight: 24, color: '#FFFFFF', marginBottom: 18 },
  small: { fontSize: 12, lineHeight: 18, color: '#a7bdc7' },
  input: {
    borderWidth: 1,
    borderColor: '#3b4c54',
    borderRadius: 10,
    color: 'white',
    padding: 14,
    marginBottom: 20,
    minHeight: 48,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  team: {
    width: '30%',
    minHeight: 100,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#31454e',
    borderRadius: 12,
    backgroundColor: '#061a22',
  },
  teamName: { color: '#FFFFFF', fontSize: 12, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: '#31454e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#06171e',
    minHeight: 48,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  button: {
    backgroundColor: brand.primary,
    borderRadius: 12,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: 'white' },
  logo: { width: 150, height: 130, alignSelf: 'center', marginVertical: 24 },
  error: { color: '#ffb4ac', lineHeight: 22, marginVertical: 16 },
});
