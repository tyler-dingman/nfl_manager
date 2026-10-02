import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ALT_STACK_MARKETS,
  DEFAULT_ALT_STACK,
  altKey,
  altThreshold,
  rankAltStackCandidates,
  selectAltStack,
  swapAltStackLeg,
  type AltStackConfig,
  type AltStackLeg,
} from '../../../src/lib/parlay-lab/alt-stack';
import { authenticatedFetch } from '../lib/auth';
import type { ParlayEvent, ParlayMarket } from '../lib/parlay';
import { SectionMenu } from './section-menu';
export function ParlayAltStack({
  events,
  slip,
  setSlip,
  onOpen,
}: {
  events: ParlayEvent[];
  slip: ParlayMarket[];
  setSlip: (v: ParlayMarket[]) => void;
  onOpen: (v: ParlayMarket) => void;
}) {
  const [config, setConfig] = useState<AltStackConfig>({ ...DEFAULT_ALT_STACK }),
    [stack, setStack] = useState<AltStackLeg[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  async function fresh() {
    const response = await authenticatedFetch('/api/parlay-lab/alt-stack');
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.markets) || !Array.isArray(data.events))
      throw new Error('Alternate lines are unavailable. Please retry.');
    return rankAltStackCandidates(data.markets, data.events, config);
  }
  async function build(index?: number) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const pool = await fresh();
      if (index != null) {
        const replacement = swapAltStackLeg(pool, stack, index);
        if (!replacement)
          throw new Error(
            'No other qualifying player at this sportsbook. Try changing your filters.',
          );
        setStack(stack.map((m, i) => (i === index ? replacement : m)));
      } else {
        const result = selectAltStack(pool, config.legs);
        if (!result.legs.length)
          throw new Error(
            `Only ${result.available} qualifying players are available together at one sportsbook. Choose fewer legs or broaden your filters.`,
          );
        setStack(result.legs);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to build.');
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    if (busy) return;
    setBusy(true);
    try {
      const pool = await fresh();
      if (
        !stack.every((m) =>
          pool.some((n) => altKey(m) === altKey(n) && m.line === n.line && m.odds === n.odds),
        )
      )
        throw new Error('Lines changed. Generate a new stack before adding.');
      setSlip([...slip, ...stack.filter((m) => !slip.some((n) => altKey(n) === altKey(m)))]);
      setNotice('Added to My Parlay below. Review and save when ready.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to refresh.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>ALT STACK</Text>
      <Text style={s.gold}>HIGH-FREQUENCY THRESHOLDS. ONE BUILD.</Text>
      <Text style={s.copy}>
        Choose your target, then build a stack of priced alternate lines with historical support.
      </Text>
      {(['legs', 'targetOdds', 'minHits'] as const).map((key) => (
        <SectionMenu
          key={key}
          title={`${key === 'legs' ? 'Legs' : key === 'targetOdds' ? 'Target odds per leg' : 'Minimum hits in last 10'}: ${config[key]}`}
          items={(key === 'legs'
            ? [2, 3, 4, 5, 6, 7, 8]
            : key === 'targetOdds'
              ? [-200, -250, -300, -350, -400, -500]
              : [7, 8, 9, 10]
          ).map((value) => ({
            label: String(value),
            selected: config[key] === value,
            onPress: () => setConfig({ ...config, [key]: value }),
          }))}
        />
      ))}
      <SectionMenu
        title={config.games.length ? `${config.games.length} selected games` : 'All upcoming games'}
        items={[
          {
            label: 'All upcoming games',
            selected: !config.games.length,
            onPress: () => setConfig({ ...config, games: [] }),
          },
          ...events.map((e) => ({
            label: `${e.awayTeamId} @ ${e.homeTeamId}`,
            selected: config.games.includes(e.id),
            onPress: () =>
              setConfig({
                ...config,
                games: config.games.includes(e.id)
                  ? config.games.filter((id) => id !== e.id)
                  : [...config.games, e.id],
              }),
          })),
        ]}
      />
      <Text style={s.title}>MARKETS</Text>
      {ALT_STACK_MARKETS.map((m) => (
        <Pressable
          key={m}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: config.markets.includes(m) }}
          onPress={() =>
            setConfig({
              ...config,
              markets: config.markets.includes(m)
                ? config.markets.filter((x) => x !== m)
                : [...config.markets, m],
            })
          }
          style={s.row}
        >
          <Text style={s.copy}>
            {config.markets.includes(m) ? '✓' : '○'} {m.replaceAll('_', ' ')}
          </Text>
        </Pressable>
      ))}
      <Pressable
        disabled={busy || !config.markets.length}
        onPress={() => void build()}
        style={s.button}
      >
        <Text style={s.label}>{busy ? 'SCANNING AVAILABLE LINES…' : 'GENERATE ALT STACK'}</Text>
      </Pressable>
      {!!notice && (
        <Text accessibilityRole="alert" style={s.copy}>
          {notice}
        </Text>
      )}
      {stack.map((m, i) => (
        <View key={altKey(m)} style={s.leg}>
          <Pressable onPress={() => onOpen(m)}>
            <Text style={s.title}>{m.playerName}</Text>
            <Text style={s.gold}>
              {altThreshold(m)} {m.marketType.replaceAll('_', ' ')} · {m.odds}
            </Text>
            <Text style={s.copy}>
              {m.trend?.last10.hits}/10 hits · Main line {m.mainLine} · {m.sportsbook}
            </Text>
          </Pressable>
          <View style={s.row}>
            <Pressable disabled={busy} onPress={() => void build(i)} style={s.row}>
              <Text style={s.label}>SWAP LEG</Text>
            </Pressable>
            <Pressable onPress={() => setStack(stack.filter((_, j) => j !== i))} style={s.row}>
              <Text style={s.label}>REMOVE</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {!!stack.length && (
        <Pressable disabled={busy} onPress={() => void add()} style={s.button}>
          <Text style={s.label}>ADD STACK TO MY PARLAY</Text>
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  title: { fontSize: 28, fontFamily: 'BarlowCondensed', color: 'white' },
  gold: { fontSize: 13, fontWeight: '800', color: '#FFCA00' },
  copy: { fontSize: 15, lineHeight: 22, color: '#B8CBD4' },
  label: { color: 'white', fontWeight: '800' },
  row: { padding: 10, flexDirection: 'row', gap: 16 },
  button: { backgroundColor: '#FF123B', padding: 18, borderRadius: 8 },
  leg: { borderWidth: 1, borderColor: '#285064', padding: 16, borderRadius: 10, gap: 12 },
});
