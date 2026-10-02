import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandIntro } from './brand-intro';
import { FieldLaunchAnimation } from './field-launch-animation';
import { FIELD_USE_SHORT_RETURNING_INTRO, LAUNCH_ANIMATION_VARIANT } from '../lib/launch/config';
import { completeIntro, hasCompletedIntro } from '../lib/intro-state';

/** One launch per mounted app, independent of authentication/network resolution. */
export function LaunchAnimation({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<{ short: boolean; reduced: boolean } | null>(null);
  const [finished, setFinished] = useState(false);
  const entryFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!finished) return;
    const fade = Animated.timing(entryFade, {
      toValue: 1,
      duration: settings?.reduced ? 0 : 250,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [finished, settings?.reduced, entryFade]);
  const finish = useCallback(() => {
    void completeIntro();
    setFinished(true);
  }, []);
  useEffect(() => {
    let active = true;
    // Storage/accessibility failures must never hold startup indefinitely.
    const fallback = setTimeout(() => {
      if (active) setSettings((s) => s ?? { short: true, reduced: true });
    }, 700);
    void Promise.all([
      hasCompletedIntro(),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => true),
    ]).then(([short, reduced]) => {
      if (active) setSettings((current) => current ?? { short, reduced });
    });
    return () => {
      active = false;
      clearTimeout(fallback);
    };
  }, []);
  useEffect(() => {
    if (!settings || finished) return;
    const watchdog = setTimeout(finish, LAUNCH_ANIMATION_VARIANT === 'orbit' ? 8500 : 5950);
    let interrupted = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') interrupted = true;
      else if (interrupted) finish();
    });
    return () => {
      clearTimeout(watchdog);
      sub.remove();
    };
  }, [settings, finished, finish]);
  if (finished)
    return (
      <View style={{ flex: 1, backgroundColor: '#001016' }}>
        <Animated.View style={{ flex: 1, opacity: entryFade }}>{children}</Animated.View>
      </View>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#001016' }}>
      {!settings ? (
        <View />
      ) : LAUNCH_ANIMATION_VARIANT === 'orbit' ? (
        <BrandIntro onDone={finish} />
      ) : (
        <FieldLaunchAnimation onDone={finish} short={Platform.OS !== 'web' && settings.short && FIELD_USE_SHORT_RETURNING_INTRO} reduced={settings.reduced} />
      )}
    </SafeAreaView>
  );
}
