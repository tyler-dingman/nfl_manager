import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HomeMarket } from '../../../packages/parlay/research';
import type { PropGroup } from '../../../packages/parlay/prop-groups';
import {
  PRIMARY_MARKETS,
  primaryMarketOptions,
  secondaryMarketOptions,
  propMarketLabel,
  type MarketFacet,
} from '../../../packages/parlay/market-navigation';
import { propPick } from '../../../packages/parlay/anytime-td';
import { formatProjection } from '../../../packages/parlay/projection-display';
import { catalogScore } from '../../../packages/parlay/prop-catalog';
import { labScoreBand, labScoreColor } from '../../../packages/parlay/lab-score-config';
import { sportsbookName } from '../../../src/server/odds/sportsbooks';
import { LabScoreHelp } from './lab-score-help';
export function PropMarketNavigation({
  facets,
  category,
  market,
  onCategory,
  onMarket,
  accent,
}: {
  facets: MarketFacet[];
  category: string;
  market: string;
  onCategory: (v: string) => void;
  onMarket: (v: string) => void;
  accent: string;
}) {
  const drilled = category !== 'ALL';
  const label = PRIMARY_MARKETS.find(([id]) => id === category)?.[1] ?? category;
  const options = drilled
    ? secondaryMarketOptions(facets, category)
    : primaryMarketOptions(facets).map(([id, label]) => ({ id, label }));
  const selected = drilled ? market : 'ALL';
  const track = useRef<ScrollView>(null);
  const width = useRef(0);
  const positions = useRef(new Map<string, { x: number; width: number }>());
  const scrollSelected = useCallback(() => {
    const position = positions.current.get(`${category}:${selected}`);
    if (position)
      track.current?.scrollTo({
        x: Math.max(0, position.x - (width.current - position.width) / 2),
        animated: false,
      });
  }, [category, selected]);
  useEffect(() => {
    scrollSelected();
  }, [scrollSelected]);
  return (
    <View style={{ gap: 4, marginBottom: 8 }}>
      {drilled && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          accessibilityLabel={`All Props, ${label}`}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to all prop categories"
            onPress={() => onCategory('ALL')}
            hitSlop={4}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={{ color: '#a8bac4', fontSize: 12 }}>‹ All Props</Text>
          </Pressable>
          <Text style={{ color: '#7893a1' }} accessibilityElementsHidden>
            /
          </Text>
          <Text style={{ color: '#f4f8fc', fontSize: 12, fontWeight: '600' }}>{label}</Text>
        </View>
      )}
      <ScrollView
        key={category}
        ref={track}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
        accessibilityLabel={drilled ? `${label} markets` : 'Market categories'}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
          scrollSelected();
        }}
        onContentSizeChange={scrollSelected}
      >
        {options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === option.id }}
            onLayout={(e) => {
              positions.current.set(`${category}:${option.id}`, e.nativeEvent.layout);
              if (selected === option.id) scrollSelected();
            }}
            onPress={() => (drilled ? onMarket(option.id) : onCategory(option.id))}
            style={[
              s.category,
              {
                minHeight: 44,
                justifyContent: 'center',
                backgroundColor: selected === option.id ? '#ff123e' : '#092532',
                borderWidth: 1,
                borderColor: selected === option.id ? '#ff123e' : '#193e4d',
              },
            ]}
          >
            <Text
              style={[
                s.text,
                selected === option.id && { fontWeight: '700', textDecorationLine: 'underline' },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function PropDiscoveryTable({
  groups,
  events,
  slip,
  onOpen,
  onAdd,
  accent,
}: {
  groups: PropGroup[];
  events: { id: string; homeTeamId: string; awayTeamId: string }[];
  slip: HomeMarket[];
  onOpen: (m: HomeMarket) => void;
  onAdd: (m: HomeMarket) => void;
  accent: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  return (
    <View style={{ gap: 12 }}>
      {groups.map((group) => {
        const open = expanded.has(group.key),
          more = group.selections.length - 1,
          primary = group.primary;
        const game = events.find((e) => e.id === primary.eventId);
        return (
          <View key={group.key} style={s.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Research ${primary.playerName} ${propMarketLabel(primary)}`}
              onPress={() => onOpen(primary)}
              style={s.identity}
            >
              {primary.headshotUrl && (
                <Image
                  source={{ uri: primary.headshotUrl }}
                  accessibilityLabel={primary.playerName ?? 'Player'}
                  alt={primary.playerName ?? 'Player'}
                  style={{ width: 36, height: 36 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{primary.playerName}</Text>
                <Text style={s.muted}>
                  {primary.teamId} · {primary.position} ·{' '}
                  {game ? `${game.awayTeamId} @ ${game.homeTeamId}` : '—'}
                </Text>
                <Text style={s.text}>{propMarketLabel(primary)}</Text>
              </View>
            </Pressable>
            {(open ? group.selections : [primary]).map((m, index) => {
              const score = catalogScore(m),
                added = slip.some((leg) => leg.id === m.id && leg.sportsbook === m.sportsbook);
              const name = `${m.playerName} ${propMarketLabel(m)} ${propPick(m)} at ${sportsbookName(m.sportsbook)}`;
              return (
                <View
                  key={`${m.id}:${m.sportsbook}`}
                  style={[
                    s.selection,
                    index > 0 && {
                      marginLeft: 12,
                      borderLeftWidth: 3,
                      borderLeftColor: accent,
                      backgroundColor: '#092532',
                    },
                  ]}
                >
                  {m.lineType === 'alternate' && (
                    <Text style={s.muted}>
                      {index ? '↳ ALT LINE' : 'ALT LINE · BEST AVAILABLE'}
                    </Text>
                  )}
                  {index > 0 && m.lineType !== 'alternate' && (
                    <Text style={s.muted}>↳ Additional standard line</Text>
                  )}
                  <View style={s.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Research ${name}`}
                      onPress={() => onOpen(m)}
                      style={{ flex: 1 }}
                    >
                      <Text style={s.pick}>{propPick(m)}</Text>
                    </Pressable>
                    <View>
                      <Text style={s.pick}>
                        {m.odds == null ? '—' : `${m.odds > 0 ? '+' : ''}${m.odds}`}
                      </Text>
                      <Text style={s.muted}>{sportsbookName(m.sportsbook)}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${name} to parlay`}
                      accessibilityState={{ disabled: added }}
                      disabled={added}
                      onPress={() => onAdd(m)}
                      style={s.add}
                    >
                      <Text style={s.pick}>{added ? '✓' : '+'}</Text>
                    </Pressable>
                  </View>
                  <View style={s.row}>
                    <View style={s.metric}>
                      <View style={s.row}>
                        <Text style={s.muted}>Lab Score</Text>
                        <LabScoreHelp />
                      </View>
                      <Text style={[s.text, { color: labScoreColor(score) }]}>
                        {score == null
                          ? '—'
                          : `${Math.round(score)} · ${labScoreBand(score).label}`}
                      </Text>
                    </View>
                    <View style={s.metric}>
                      <Text style={s.muted}>Projection</Text>
                      <Text style={s.text}>{formatProjection(m)}</Text>
                    </View>
                    <View style={s.metric}>
                      <Text style={s.muted}>L10</Text>
                      <Text style={s.text}>
                        {m.trend?.last10.games
                          ? `${m.trend.last10.hits}/${m.trend.last10.games}`
                          : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {more > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${primary.playerName} ${propMarketLabel(primary)} lines`}
                accessibilityState={{ expanded: open }}
                onPress={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(group.key)) next.delete(group.key);
                    else next.add(group.key);
                    return next;
                  })
                }
                style={{ padding: 14 }}
              >
                <Text style={s.text}>
                  {open ? '▾' : '▸'} {more} more {more === 1 ? 'line' : 'lines'}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  group: {
    backgroundColor: '#031923',
    borderColor: '#193e4d',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  selection: { padding: 14, borderTopColor: '#193e4d', borderTopWidth: 1, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metric: { flex: 1, gap: 4 },
  title: { fontWeight: '700', color: '#f4f8fc', fontSize: 16 },
  text: { color: '#e2ebf0', fontSize: 12 },
  muted: { color: '#a8bac4', fontSize: 10 },
  pick: { fontWeight: '700', color: '#f4f8fc', fontSize: 18 },
  add: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12313f',
    borderRadius: 5,
  },
  category: { padding: 12, borderRadius: 5 },
});
