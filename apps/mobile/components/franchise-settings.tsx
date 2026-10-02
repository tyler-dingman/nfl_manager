import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { authenticatedFetch } from '../lib/auth';
import { useTeamBranding } from '../lib/team-branding';
import type { FranchiseSimulationState } from '../../../src/types/front-office';
const groups = [
  {
    title: 'Display',
    description: 'Personalize how your franchise and content appear.',
    fields: [
      ['reducedMotion', 'Reduce motion'],
      ['showAroundLeague', 'Show around the league'],
      ['autoplayVideo', 'Autoplay video previews'],
    ],
  },
  {
    title: 'Notifications',
    description: 'Choose how important developments reach you.',
    fields: [
      ['pushEnabled', 'Push notifications'],
      ['emailEnabled', 'Email notifications'],
    ],
  },
];
export function FranchiseSettings({
  saveId,
  simulation,
}: {
  saveId: string;
  simulation: FranchiseSimulationState;
}) {
  const { teamId, theme } = useTeamBranding();
  const [values, setValues] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void authenticatedFetch('/api/user/preferences')
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (active) setValues(data.preferences);
      })
      .catch(() => {
        if (active) setError('Unable to load preferences. Reopen Settings to retry.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function update(key: string, value: boolean) {
    if (busy || !values) return;
    setBusy(true);
    setError('');
    try {
      const r = await authenticatedFetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setValues(data.preferences);
    } catch {
      setError('Unable to save your preference. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={s.title}>SETTINGS</Text>
      <Text style={s.copy}>Customize your Front Office experience and account preferences.</Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.copy}>
          {error}
        </Text>
      )}
      {!values && !error && <ActivityIndicator color="white" />}
      {groups.map((group) => (
        <View style={s.card} key={group.title}>
          <Text style={s.heading}>{group.title}</Text>
          <Text style={s.copy}>{group.description}</Text>
          {group.fields.map(([key, label]) => (
            <View key={key} style={s.row}>
              <Text style={[s.name, { flex: 1 }]}>{label}</Text>
              <Switch
                accessibilityLabel={label}
                disabled={busy || !values}
                value={Boolean(values?.[key])}
                onValueChange={(value) => void update(key, value)}
                trackColor={{ true: theme.primaryFill }}
              />
            </View>
          ))}
        </View>
      ))}
      <Pressable style={s.card} onPress={() => router.push('/notification-settings')}>
        <Text style={s.name}>Manage notification categories →</Text>
      </Pressable>
      <View style={s.card}>
        <Text style={s.heading}>SAVED GAME</Text>
        <Text style={s.name}>
          {teamId} · {simulation.season}
        </Text>
        <Text style={s.copy}>
          Week {simulation.currentWeek} · {simulation.teams[teamId]?.record.wins ?? 0}–
          {simulation.teams[teamId]?.record.losses ?? 0}
        </Text>
        <Text style={s.copy}>Your franchise state saves after completed actions.</Text>
        <Pressable
          style={s.row}
          onPress={() =>
            void Share.share({ message: `Front Office save: ${saveId}` }).catch(() =>
              setError('Unable to share save ID.'),
            )
          }
        >
          <Text style={s.name}>Share save ID ↗</Text>
        </Pressable>
      </View>
      <Pressable style={s.card} onPress={() => router.push('/security')}>
        <Text style={s.heading}>PRIVACY & ACCOUNT</Text>
        <Text style={s.copy}>Passwords, connected accounts, and active devices →</Text>
      </Pressable>
      <Pressable style={s.card} onPress={() => router.push('/team-select')}>
        <Text style={s.name}>Explore another team →</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  title: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 34, marginVertical: 12 },
  heading: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 25 },
  copy: { color: '#AFC5D3', fontSize: 13, lineHeight: 21, marginVertical: 8 },
  name: { color: 'white', fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: '#06222B',
    borderWidth: 1,
    borderColor: '#36505B',
    borderRadius: 8,
    padding: 18,
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#36505B',
  },
});
