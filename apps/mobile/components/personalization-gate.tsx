import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { onboardingRequest, saveOnboardingStep, type Delivery } from '../lib/onboarding';
import { onboardingEntry, isLegacyAccount } from '../lib/onboarding-policy';
import { TEAM_LIST } from '../../../src/data/teams';
import { PersonalizationOnboarding } from './personalization-onboarding';

export function PersonalizationGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const homeFade = useRef(new Animated.Value(1)).current;
  const reduced = useRef(false);
  const [finishedHere, setFinishedHere] = useState(false);
  useEffect(() => {
    if (!finishedHere) return;
    router.replace('/(tabs)');
    const animation = Animated.timing(homeFade, {
      toValue: 1,
      duration: reduced.current ? 0 : 350,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [finishedHere, router, homeFade]);
  const { user } = useAuth();
  const [state, setState] = useState<{
    step: number;
    team: string;
    delivery: Delivery;
    established: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setError('');
    void Promise.all(
      [
        '/api/user/onboarding',
        '/api/user/preferences',
        '/api/user/profile',
        '/api/three-and-out/preferences',
        '/api/user/notification-preferences',
      ].map((path) => onboardingRequest(path)),
    )
      .then(async ([progress, preferences, profile, delivery, notifications]) => {
        const selected = preferences.preferences?.preferredTeamId;
        const team = TEAM_LIST.some((t) => t.abbr === selected) ? selected : '';
        const step = onboardingEntry({
          completed: !!progress.onboarding?.completed,
          step: progress.onboarding?.step ?? 1,
          team,
          createdAt: profile.profile?.createdAt,
          hasDeliveryRecord: !!notifications.preferences?.some(
            (p: { category: string }) => p.category === 'THREE_AND_OUT_DAILY',
          ),
        });
        if (step === 0 && !progress.onboarding?.completed) await saveOnboardingStep(5, true);
        if (active)
          setState({
            step,
            team,
            delivery: delivery.preferences,
            established:
              !!progress.onboarding?.completed ||
              (isLegacyAccount(profile.profile?.createdAt) &&
                !!notifications.preferences?.some(
                  (p: { category: string }) => p.category === 'THREE_AND_OUT_DAILY',
                )),
          });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user?.id, attempt]);
  if (!user || state?.step === 0)
    return (
      <View style={{ flex: 1, backgroundColor: '#001016' }}>
        <Animated.View testID="onboarding-home-transition" style={{ flex: 1, opacity: homeFade }}>
          {children}
        </Animated.View>
      </View>
    );
  if (!state)
    return (
      <View style={{ flex: 1, backgroundColor: '#001016', justifyContent: 'center', padding: 24 }}>
        {error ? (
          <>
            <Text style={{ color: '#ffb4ac', lineHeight: 24 }}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((x) => x + 1)}
              style={{ padding: 20 }}
            >
              <Text style={{ color: '#F4D9B7' }}>Retry setup</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color="#FF3D38" />
        )}
      </View>
    );
  return (
    <PersonalizationOnboarding
      initial={state}
      onComplete={(reduceMotion) => {
        reduced.current = reduceMotion;
        homeFade.setValue(reduceMotion ? 1 : 0);
        setState({ ...state, step: 0 });
        setFinishedHere(true);
      }}
    />
  );
}
