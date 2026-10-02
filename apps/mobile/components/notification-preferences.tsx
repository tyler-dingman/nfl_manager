import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NOTIFICATION_CATEGORIES } from '../../../packages/notifications/settings';
import { authenticatedFetch } from '../lib/auth';
import { useTeamBranding } from '../lib/team-branding';
import {
  DEFAULT_DELIVERY_TIME,
  DELIVERY_PRESETS,
  deviceTimezone,
  timezoneLabel,
} from '../../../packages/three-and-out/schedule';
import { MobileFilterBar } from './mobile-filter-bar';
import { C } from './screen';

const icons = {
  Bell: 'bell',
  BriefcaseBusiness: 'briefcase',
  CalendarDays: 'calendar',
  Newspaper: 'file-text',
  Trophy: 'award',
  Users: 'users',
} as const;
export default function NotificationPreferences() {
  const { theme } = useTeamBranding();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [delivery, setDelivery] = useState<{
    email: boolean;
    sms: boolean;
    push: boolean;
    enabled: boolean;
    deliveryTime?: string;
    timezone?: string;
    hasPushDevice?: boolean;
    hasVerifiedPhone?: boolean;
    emailAvailable?: boolean;
  } | null>(null);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setMessage('');
    void Promise.all([
      authenticatedFetch('/api/user/notification-preferences'),
      authenticatedFetch('/api/three-and-out/preferences'),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error();
        const [notifications, three] = await Promise.all([a.json(), b.json()]);
        if (!active) return;
        const saved = notifications.preferences.filter(
          (p: { channel: string; topicType?: string; topicId?: string }) =>
            p.channel === 'IN_APP' && !p.topicType && !p.topicId,
        );
        setPrefs(
          Object.fromEntries(
            NOTIFICATION_CATEGORIES.map((c) => [
              c.key,
              saved.find((p: { category: string }) => p.category === c.key)?.enabled ?? true,
            ]),
          ),
        );
        setDelivery({
          ...three.preferences,
          deliveryTime: three.preferences.deliveryTime ?? DEFAULT_DELIVERY_TIME,
          timezone: three.preferences.timezone ?? deviceTimezone(),
        });
      })
      .catch(() => {
        if (active) setMessage('Unable to load preferences. Please try again.');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  async function update(keys: string[], enabled: boolean) {
    setBusy(true);
    setMessage('');
    let failed = false;
    for (const category of keys) {
      try {
        const r = await authenticatedFetch('/api/user/notification-preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ category, channel: 'IN_APP', enabled }),
        });
        if (!r.ok) throw new Error();
        setPrefs((p) => ({ ...p, [category]: enabled }));
      } catch {
        failed = true;
      }
    }
    setMessage(
      failed ? 'Some changes could not be saved. Please try again.' : 'Preferences updated ✓',
    );
    setBusy(false);
  }
  async function toggleDelivery(key: 'email' | 'sms' | 'push') {
    if (!delivery) return;
    setBusy(true);
    setMessage('');
    const next = {
      ...delivery,
      ...(delivery.enabled ? {} : { email: false, sms: false, push: false }),
      [key]: !(delivery.enabled && delivery[key]),
    };
    try {
      const r = await authenticatedFetch('/api/three-and-out/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...next, enabled: next.email || next.sms || next.push }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Unable to save delivery preferences.');
      setDelivery(body.preferences);
      setMessage('Delivery preferences updated ✓');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save delivery preferences.');
    } finally {
      setBusy(false);
    }
  }
  async function saveTime(deliveryTime: string) {
    if (!delivery || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const r = await authenticatedFetch('/api/three-and-out/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...delivery,
          deliveryTime,
          timezone: delivery.timezone ?? deviceTimezone(),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error();
      setDelivery(body.preferences);
      setMessage('Delivery preferences updated ✓');
    } catch {
      setMessage('Unable to save delivery time. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const deliveryTime = delivery?.deliveryTime ?? DEFAULT_DELIVERY_TIME;
  const isCustom = custom || !DELIVERY_PRESETS.some((p) => p.time === deliveryTime);
  const allOn = NOTIFICATION_CATEGORIES.every((c) => prefs?.[c.key]);
  return (
    <>
      <View style={s.card}>
        <View style={s.header}>
          <Text style={s.title}>Notification Preferences</Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !prefs}
            style={s.button}
            onPress={() =>
              void update(
                NOTIFICATION_CATEGORIES.map((c) => c.key),
                !allOn,
              )
            }
          >
            <Text style={s.label}>Turn All {allOn ? 'Off' : 'On'}</Text>
          </Pressable>
        </View>
        <Text style={s.copy}>
          Choose what you want to hear about. You can update these at any time.
        </Text>
        {prefs ? (
          NOTIFICATION_CATEGORIES.map((c) => (
            <View key={c.key} style={s.row}>
              <Feather name={icons[c.icon]} size={22} color={C.navy} />
              <View style={s.flex}>
                <Text style={s.label}>{c.label}</Text>
                <Text style={s.copy}>{c.description}</Text>
              </View>
              <Switch
                accessibilityLabel={c.label}
                disabled={busy}
                value={prefs[c.key]}
                onValueChange={(value) => void update([c.key], value)}
                trackColor={{ false: '#a6b4c0', true: theme.primaryFill }}
              />
            </View>
          ))
        ) : (
          <Pressable style={s.button} onPress={() => setAttempt((n) => n + 1)}>
            <Text>{message ? 'Try again' : 'Loading preferences…'}</Text>
          </Pressable>
        )}
      </View>
      <View style={s.card}>
        <Text style={s.title}>Three &amp; Out Delivery</Text>
        <Text style={s.copy}>Choose how you want to receive your daily Three &amp; Out.</Text>
        <Text style={s.copy}>Daily email and SMS delivery are not available yet. Saved preferences do not activate those channels.</Text>
        <View style={s.channels}>
          {(['email', 'sms', 'push'] as const).map((key, i) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{
                selected: !!(delivery?.enabled && delivery[key]),
                disabled: busy || !delivery,
              }}
              disabled={busy || !delivery}
              onPress={() => void toggleDelivery(key)}
              style={[
                s.channel,
                delivery?.enabled &&
                  delivery[key] && {
                    borderColor: theme.primaryFill,
                    backgroundColor: theme.primaryFill,
                  },
              ]}
            >
              <Feather
                name={(['mail', 'message-square', 'bell'] as const)[i]}
                size={22}
                color={delivery?.enabled && delivery[key] ? theme.onPrimary : C.navy}
              />
              <Text
                style={[s.label, delivery?.enabled && delivery[key] && { color: theme.onPrimary }]}
              >
                {key.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.label, { marginTop: 18 }]}>WHEN SHOULD WE SEND IT?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {DELIVERY_PRESETS.map((p) => {
            const selected = p.id === 'custom' ? isCustom : !isCustom && p.time === deliveryTime;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: busy || !delivery }}
                disabled={busy || !delivery}
                style={[
                  s.channel,
                  { flexBasis: '46%', minHeight: 60 },
                  selected && { backgroundColor: theme.primaryFill },
                ]}
                onPress={() => {
                  setCustom(p.id === 'custom');
                  if (p.time) void saveTime(p.time);
                }}
              >
                <Text style={[s.label, selected && { color: theme.onPrimary }]}>
                  {p.label.toUpperCase()}
                </Text>
                <Text style={[s.copy, selected && { color: theme.onPrimary }]}>{p.detail}</Text>
              </Pressable>
            );
          })}
        </View>
        {isCustom ? (
          <View style={{ marginTop: 12 }}>
            <Text style={s.label}>Delivery time</Text>
            <MobileFilterBar
              primary={[
                {
                  key: 'hour',
                  label: 'Hour',
                  defaultValue: '07',
                  options: Array.from({ length: 24 }, (_, h) => ({
                    value: String(h).padStart(2, '0'),
                    label: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`,
                  })),
                },
                {
                  key: 'minute',
                  label: 'Minute',
                  defaultValue: '00',
                  options: Array.from({ length: 60 }, (_, m) => ({
                    value: String(m).padStart(2, '0'),
                    label: String(m).padStart(2, '0'),
                  })),
                },
              ]}
              secondary={[]}
              values={{ hour: deliveryTime.slice(0, 2), minute: deliveryTime.slice(3) }}
              onChange={(values) => {
                if (!busy) void saveTime(`${values.hour}:${values.minute}`);
              }}
            />
          </View>
        ) : null}
        <Text style={s.copy}>
          Times shown in {timezoneLabel(delivery?.timezone ?? deviceTimezone())}
        </Text>
        {delivery?.sms && delivery.hasVerifiedPhone === false ? (
          <Text style={s.copy}>Add a verified mobile number for SMS delivery.</Text>
        ) : null}
        {delivery?.push && delivery.hasPushDevice === false ? (
          <Text style={s.copy}>Enable notifications on a device for push delivery.</Text>
        ) : null}
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={s.copy}>
          {message}
        </Text>
      ) : null}
      <View style={s.card}>
        <Text style={s.title}>You’re in control</Text>
        <Text style={s.copy}>You can update your notification preferences at any time.</Text>
      </View>
    </>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf1f5',
    padding: 16,
    marginTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: { fontSize: 16, fontWeight: '800', color: C.navy },
  copy: { fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: C.navy },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#edf1f5',
    marginTop: 8,
  },
  flex: { flex: 1 },
  channels: { flexDirection: 'row', gap: 8, marginTop: 14 },
  channel: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#dce4ec',
    borderRadius: 10,
  },
});
