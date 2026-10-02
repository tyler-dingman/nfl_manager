import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Pressable, View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { deviceStorage } from '../lib/device-storage';
import {
  defaultNewsPreferences,
  eligibleNewsToasts,
  newsBatchSummary,
  newsPersona,
} from '../../../src/lib/front-office-news-presentation';
import type { FrontOfficeEvent } from '../../../src/types/front-office';
export function FrontOfficeNewsToast() {
  const path = usePathname();
  const activeSave = useRef<string | null>(null);
  const [batch, setBatch] = useState<FrontOfficeEvent[]>([]),
    [saveId, setSaveId] = useState(''),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    const active = DeviceEventEmitter.addListener('front-office-news-active', (payload) => {
      activeSave.current = payload.saveId;
      setBatch([]);
    });
    const sub = DeviceEventEmitter.addListener(
      'front-office-news-updated',
      async (payload: { events: FrontOfficeEvent[]; saveId: string; teamAbbr: string }) => {
        const raw = await deviceStorage.get(`fo-news-preferences:${payload.saveId}`);
        let prefs = defaultNewsPreferences;
        try {
          prefs = { ...prefs, ...JSON.parse(raw ?? '{}') };
        } catch {}
        if (activeSave.current !== payload.saveId) return;
        const events = eligibleNewsToasts(payload.events, payload.teamAbbr, prefs);
        if (
          events.length === 0 ||
          (events.length === 1 && !['high', 'urgent'].includes(events[0].priority))
        )
          return;
        setSaveId(payload.saveId);
        setBatch((old) => [
          ...new Map(
            [...old.filter((e) => e.saveId === payload.saveId), ...events].map((e) => [e.id, e]),
          ).values(),
        ]);
      },
    );
    return () => {
      sub.remove();
      active.remove();
    };
  }, []);
  useEffect(() => {
    if (!batch.length || paused) return;
    const t = setTimeout(() => setBatch([]), 8000);
    return () => clearTimeout(t);
  }, [batch, paused]);
  useEffect(() => {
    if (path !== '/front-office') setBatch([]);
  }, [path]);
  if (!batch.length || path !== '/front-office') return null;
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 95,
        right: 12,
        left: 12,
        zIndex: 10000,
        elevation: 30,
        backgroundColor: '#030b10',
        borderWidth: 1,
        borderColor: '#385768',
        borderRadius: 12,
        padding: 18,
      }}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPress={() => {
          DeviceEventEmitter.emit('front-office-news-open', { saveId });
          setBatch([]);
        }}
        style={{ paddingRight: 30 }}
      >
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
          {batch.length > 1 ? `${batch.length} new updates` : newsPersona(batch[0])}
        </Text>
        <Text style={{ color: '#b3ccd9', marginTop: 8, lineHeight: 21 }}>
          {batch.length > 1 ? newsBatchSummary(batch) : batch[0].headline}
        </Text>
        <Text style={{ color: 'white', marginTop: 10 }}>View News →</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Dismiss notification"
        onPress={() => setBatch([])}
        style={{ position: 'absolute', right: 5, top: 5, padding: 12 }}
      >
        <Text style={{ color: 'white', fontSize: 22 }}>×</Text>
      </Pressable>
    </View>
  );
}
