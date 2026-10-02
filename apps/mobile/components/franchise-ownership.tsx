import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  PROJECTS,
  SPONSORS,
  initialOwnership,
  ownershipMetrics,
  ownershipReducer,
  reportCard,
  type OwnershipAction,
  type OwnershipState,
} from '../../../src/features/ownership/model';
import type { FranchiseSimulationState } from '../../../src/types/front-office';
import { largeDeviceStorage } from '../lib/large-device-storage';
import { useTeamBranding } from '../lib/team-branding';
import { SectionMenu } from './section-menu';
const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${n.toFixed(1)}M`);
const sections = [
  ['central', 'Ownership Central'],
  ['stadium', 'Stadium'],
  ['facilities', 'Facilities'],
  ['business', 'Business'],
  ['fans', 'Fan Experience'],
  ['report-card', 'Report Card'],
  ['legacy', 'Legacy'],
] as const;
export function FranchiseOwnership({
  saveId,
  simulation,
  initialFacility,
}: {
  initialFacility?: string;
  saveId: string;
  simulation: FranchiseSimulationState;
}) {
  const { teamId, theme } = useTeamBranding();
  const [state, setState] = useState<OwnershipState | null>(null);
  const [section, setSection] = useState<string>(initialFacility ? 'facilities' : 'central');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState('100');
  const key = `dd-ownership-${saveId}-${teamId}`;
  useEffect(() => {
    let active = true;
    setState(null);
    setError('');
    void largeDeviceStorage
      .get(key)
      .then(async (raw) => {
        let next = raw ? (JSON.parse(raw) as OwnershipState) : initialOwnership(simulation.season);
        next = ownershipReducer(
          next,
          { type: 'advance' },
          simulation.season,
          simulation.currentWeek,
        );
        const record = simulation.teams[teamId]?.record;
        if (record)
          next = ownershipReducer(
            next,
            { type: 'record', record },
            simulation.season,
            simulation.currentWeek,
          );
        if (active) {
          await largeDeviceStorage.set(key, JSON.stringify(next));
          if (!active) return;
          setState(next);
          setTicket(String(next.ticketPrice));
        }
      })
      .catch(() => {
        if (active) setError('Unable to load ownership progress. Reopen Ownership to retry.');
      });
    return () => {
      active = false;
    };
  }, [key, simulation.season, simulation.currentWeek]);
  async function act(action: OwnershipAction) {
    if (!state || busy) return;
    setBusy(true);
    setError('');
    try {
      let next = ownershipReducer(state, action, simulation.season, simulation.currentWeek);
      const record = simulation.teams[teamId]?.record;
      if (record)
        next = ownershipReducer(
          next,
          { type: 'record', record },
          simulation.season,
          simulation.currentWeek,
        );
      await largeDeviceStorage.set(key, JSON.stringify(next));
      setState(next);
    } catch {
      setError('Unable to save ownership progress. Your change was not applied.');
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return error ? <Text style={s.copy}>{error}</Text> : <ActivityIndicator color="white" />;
  const metrics = ownershipMetrics(state, simulation.season);
  return (
    <View>
      <Text style={s.title}>OWNERSHIP</Text>
      <Text style={s.copy}>Build a franchise that wins on and off the field.</Text>
      <SectionMenu
        title={sections.find((v) => v[0] === section)?.[1] ?? 'Ownership'}
        items={sections.map(([id, label]) => ({
          label,
          selected: section === id,
          onPress: () => setSection(id),
        }))}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={s.copy}>
          {error}
        </Text>
      )}
      <View style={s.grid}>
        {[
          ['FRANCHISE VALUE', money(metrics.value)],
          ['AVAILABLE CAPITAL', money(state.capital)],
          ['FAN SENTIMENT', `${metrics.sentiment}/100`],
          ['ANNUAL REVENUE', money(metrics.revenue)],
        ].map(([label, value]) => (
          <View style={s.metric} key={label}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.title}>{value}</Text>
          </View>
        ))}
      </View>
      {section === 'central' && (
        <>
          <Text style={s.heading}>YOUR FRANCHISE AT A GLANCE</Text>
          {[
            ['Facilities', metrics.facilities],
            ['Player development', metrics.development],
            ['Recovery', metrics.recovery],
            ['Free-agent appeal', metrics.appeal],
            ['Community', metrics.community],
          ].map(([label, value]) => (
            <View style={s.card} key={label}>
              <Text style={s.name}>
                {label} · {value}/100
              </Text>
              <View
                style={[s.meter, { width: `${Number(value)}%`, backgroundColor: theme.secondary }]}
              />
            </View>
          ))}
          <Text style={s.heading}>ACTIVE PROJECTS</Text>
          {!state.projects.length && (
            <Text style={s.copy}>No projects yet. Explore stadium and facility upgrades.</Text>
          )}
          {state.projects.map((p) => (
            <View style={s.card} key={p.id}>
              <Text style={s.name}>{PROJECTS.find((v) => v.id === p.id)?.name}</Text>
              <Text style={s.copy}>
                {p.completed
                  ? 'Completed'
                  : `${Math.max(0, p.due - (simulation.season * 52 + simulation.currentWeek))} weeks remaining`}
              </Text>
            </View>
          ))}
        </>
      )}
      {['stadium', 'facilities', 'fans', 'business'].includes(section) &&
        PROJECTS.filter((p) => p.area === section)
          .sort((a, b) => Number(b.id === initialFacility) - Number(a.id === initialFacility))
          .map((p) => {
            const scheduled = state.projects.find((v) => v.id === p.id);
            return (
              <View style={s.card} key={p.id}>
                <Text style={s.heading}>{p.name}</Text>
                <Text style={s.copy}>{p.description}</Text>
                <Text style={s.name}>
                  {money(p.cost)} · {p.weeks} weeks
                </Text>
                <Text style={s.copy}>
                  {Object.entries(p.impacts)
                    .map(([label, value]) => `+${value} ${label}`)
                    .join(' · ')}
                </Text>
                <Pressable
                  disabled={busy || !!scheduled || state.capital < p.cost}
                  style={[
                    s.button,
                    { backgroundColor: theme.primaryFill },
                    (!!scheduled || state.capital < p.cost) && { opacity: 0.5 },
                  ]}
                  onPress={() =>
                    Alert.alert(p.name, `Approve this ${money(p.cost)} investment?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Approve', onPress: () => void act({ type: 'approve', id: p.id }) },
                    ])
                  }
                >
                  <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>
                    {scheduled
                      ? scheduled.completed
                        ? 'COMPLETED'
                        : 'IN PROGRESS'
                      : state.capital < p.cost
                        ? 'INSUFFICIENT CAPITAL'
                        : 'REVIEW & APPROVE'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
      {(section === 'business' || section === 'fans') && (
        <View style={s.card}>
          <Text style={s.heading}>TICKETING</Text>
          <Text style={s.copy}>Average ticket price · ${state.ticketPrice}</Text>
          <TextInput
            accessibilityLabel="Average ticket price"
            value={ticket}
            onChangeText={setTicket}
            keyboardType="number-pad"
            style={s.input}
          />
          <Pressable
            disabled={busy}
            style={s.button}
            onPress={() => {
              const price = Number(ticket);
              if (!Number.isFinite(price) || price < 50 || price > 250) {
                setError('Enter a ticket price from $50 to $250.');
                return;
              }
              void act({ type: 'ticket', price });
            }}
          >
            <Text style={s.name}>SAVE TICKET PRICE</Text>
          </Pressable>
          <Text style={s.copy}>
            Attendance {metrics.attendance}% · Renewal {metrics.renewal}% · Affordability{' '}
            {metrics.affordability}/100
          </Text>
        </View>
      )}
      {section === 'business' &&
        SPONSORS.map((p) => (
          <View style={s.card} key={p.id}>
            <Text style={s.heading}>{p.name}</Text>
            <Text style={s.copy}>{p.description}</Text>
            <Text style={s.name}>
              {money(p.annual)} annually · {p.years} years
            </Text>
            <Pressable
              disabled={busy || metrics.activePartners.some((v) => v.id === p.id)}
              style={s.button}
              onPress={() =>
                Alert.alert(
                  'Confirm partnership',
                  `${p.name}: ${p.years} years at ${money(p.annual)} annually.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign', onPress: () => void act({ type: 'partner', id: p.id }) },
                  ],
                )
              }
            >
              <Text style={s.name}>
                {metrics.activePartners.some((v) => v.id === p.id)
                  ? 'ACTIVE PARTNER'
                  : 'REVIEW PARTNERSHIP'}
              </Text>
            </Pressable>
          </View>
        ))}
      {section === 'report-card' &&
        reportCard(state, simulation.season).map((g) => (
          <View style={s.card} key={g.name}>
            <Text style={s.heading}>{g.name}</Text>
            <Text style={s.title}>
              {g.grade} · {Math.round(g.score)}/100
            </Text>
            <Pressable
              style={s.button}
              onPress={() =>
                setSection(PROJECTS.find((p) => p.id === g.projectId)?.area ?? 'facilities')
              }
            >
              <Text style={s.name}>Explore improvements →</Text>
            </Pressable>
          </View>
        ))}
      {section === 'legacy' && (
        <>
          <Text style={s.heading}>FRANCHISE HISTORY</Text>
          {Object.values(state.snapshots ?? {})
            .sort((a, b) => b.year - a.year)
            .map((v) => (
              <View style={s.card} key={v.year}>
                <Text style={s.heading}>{v.year}</Text>
                <Text style={s.copy}>
                  Value {money(v.value)} · Fans {v.fans} · Grade {v.grade}
                </Text>
                {v.record && (
                  <Text style={s.copy}>
                    {v.record.wins}–{v.record.losses}–{v.record.ties}
                  </Text>
                )}
              </View>
            ))}
          {state.history.map((v) => (
            <View style={s.card} key={v.id}>
              <Text style={s.name}>
                {v.year} · {v.text}
              </Text>
              <Text style={s.copy}>{money(v.cost)}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  title: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 32 },
  heading: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 25, marginVertical: 10 },
  copy: { color: '#AFC5D3', fontSize: 13, lineHeight: 21, marginVertical: 8 },
  name: { color: 'white', fontWeight: '800', fontSize: 14 },
  label: { color: '#AFC5D3', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  metric: { width: '48%', padding: 14, borderWidth: 1, borderColor: '#36505B', borderRadius: 8 },
  card: {
    backgroundColor: '#06222B',
    borderWidth: 1,
    borderColor: '#36505B',
    borderRadius: 12,
    padding: 18,
    marginVertical: 8,
  },
  button: {
    backgroundColor: '#263F48',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    padding: 10,
  },
  input: { color: 'white', borderWidth: 1, borderColor: '#36505B', borderRadius: 8, padding: 14 },
  meter: { height: 7, borderRadius: 4, marginTop: 12 },
});
