import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { overviewContext } from '../../../packages/parlay/projection-details';
import type { HomeMarket, ResearchDetail } from '../../../packages/parlay/research';
import { TEAM_LIST } from '../../../src/data/teams';
import { teamLogoAssets } from '../lib/team-logo-assets';
export function OverviewTiles({
  data,
  market,
  onTab,
}: {
  data: ResearchDetail;
  market: HomeMarket;
  onTab: (tab: string) => void;
}) {
  return (
    <View style={s.tiles}>
      {overviewContext(data, market).tiles.map((tile, i) => (
        <Pressable
          key={tile.label}
          style={s.tile}
          onPress={() => onTab(tile.target)}
          accessibilityRole="button"
          accessibilityLabel={`${tile.label}: ${tile.value}. View ${tile.target}`}
        >
          <Feather
            name={(['bar-chart-2', 'shield', 'user', 'arrow-up-right'] as const)[i]}
            color="#f4f8fc"
            size={20}
          />
          <Text style={s.label}>{tile.label.toUpperCase()}</Text>
          <Text style={s.value}>{tile.value}</Text>
          <Text style={s.copy}>{tile.note}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function OverviewRail({
  data,
  market,
  onTab,
}: {
  data: ResearchDetail;
  market: HomeMarket;
  onTab: (tab: string) => void;
}) {
  const c = overviewContext(data, market),
    opponent = TEAM_LIST.find((t) => t.abbr === c.opponent);
  const date =
    data.event?.kickoffAt && Number.isFinite(Date.parse(data.event.kickoffAt))
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(new Date(data.event.kickoffAt))
      : 'Kickoff unavailable';
  return (
    <View style={{ gap: 14, marginVertical: 14 }}>
      <View style={s.card}>
        <Pressable accessibilityRole="button" onPress={() => onTab('Matchup')} style={s.title}>
          <Feather name="calendar" color="#f4f8fc" size={23} />
          <Text style={s.heading}>Next Game</Text>
        </Pressable>
        <View style={s.game}>
          {opponent && (
            <Image
              source={teamLogoAssets[opponent.abbr]}
              style={{ width: 64, height: 52 }}
              contentFit="contain"
              accessibilityLabel={opponent.name}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.value}>
              {data.event?.homeTeamId === (market.teamId ?? data.player?.teamId) ? 'vs' : '@'}{' '}
              {c.opponent ?? '—'}
            </Text>
            <Text style={s.copy}>{opponent?.name ?? 'Opponent unavailable'}</Text>
          </View>
        </View>
        <Text style={s.copy}>{date}</Text>
        {data.venue?.current?.stadium && <Text style={s.copy}>{data.venue.current.stadium}</Text>}
      </View>
      {(
        [
          { title: 'Matchup Snapshot', icon: 'shield', rows: c.matchup, target: 'Matchup' },
          { title: 'Game Environment', icon: 'sun', rows: c.environment, target: 'Splits' },
        ] as const
      ).map((section) => (
        <View key={section.title} style={s.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onTab(section.target)}
            style={s.title}
          >
            <Feather name={section.icon} color="#f4f8fc" size={23} />
            <Text style={s.heading}>{section.title}</Text>
          </Pressable>
          {section.rows.length ? (
            section.rows.map(([label, value]) => (
              <View key={label} style={s.row}>
                <Text style={[s.copy, { flex: 1 }]}>{label}</Text>
                <Text
                  style={[
                    s.copy,
                    { fontWeight: '700', color: '#f4f8fc', flex: 1, textAlign: 'right' },
                  ]}
                >
                  {value}
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.copy}>Information is unavailable.</Text>
          )}
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#183b4c',
    borderRadius: 8,
    padding: 12,
    gap: 7,
    minHeight: 125,
  },
  label: { color: '#a8bac4', fontSize: 10, fontWeight: '700' },
  value: { color: '#f4f8fc', fontFamily: 'BarlowCondensed', fontSize: 27 },
  copy: { fontSize: 12, lineHeight: 19, color: '#a8bac4' },
  heading: { fontFamily: 'BarlowCondensed', fontSize: 23, color: '#f4f8fc' },
  card: {
    backgroundColor: '#031923',
    borderColor: '#183b4c',
    borderWidth: 1,
    borderRadius: 9,
    padding: 18,
    gap: 12,
  },
  title: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: {
    flexDirection: 'row',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#183b4c',
    paddingVertical: 10,
  },
});
