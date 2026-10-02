import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DailyHuddle } from '../../../packages/huddle/daily';
import { pollResult, compactCount } from '../../../packages/huddle/daily';
import type { Poll } from '../../../packages/huddle';
import { getOnboardingTheme } from '../lib/onboarding-theme';
export function ArchivePoll({
  poll,
  team,
  inline = false,
}: {
  poll: Poll;
  team: string;
  inline?: boolean;
}) {
  const { total } = pollResult(poll),
    theme = getOnboardingTheme(team);
  return (
    <View style={s.poll}>
      {inline && <Text style={[s.small, { color: '#ffbf33', marginBottom: 6 }]}>HUDDLE POLL</Text>}
      <Text style={s.heading}>{poll.question}</Text>
      {poll.options.map((o, i) => {
        const percent = total ? Math.round(((poll.counts[i] ?? 0) / total) * 100) : 0;
        return (
          <View style={s.row} key={o}>
            <View style={s.track}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: i === 0 ? theme.primaryCTA : '#8299a9',
                    opacity: 0.45,
                  },
                ]}
              />
              <Text style={s.option}>{o}</Text>
            </View>
            <Text style={[s.option, { width: 38, textAlign: 'right' }]}>{percent}%</Text>
          </View>
        );
      })}
      <Text style={s.small}>{total.toLocaleString()} votes · Final results</Text>
    </View>
  );
}
export function ArchiveCommunity({ daily, polls }: { daily: DailyHuddle; polls: Poll[] }) {
  const theme = getOnboardingTheme(daily.team),
    featured = polls.find((p) => p.id === daily.featuredPollId),
    top = polls.find((p) => p.id === daily.topPollId),
    { total, percent } = pollResult(featured);
  return (
    <View style={{ gap: 12, marginTop: 20 }}>
      <View style={s.panel}>
        <Text style={s.panelTitle}>
          <Ionicons name="stats-chart" color={theme.accent} size={20} /> FINAL HUDDLE PULSE
        </Text>
        <View style={s.pulse}>
          <Text style={s.percent}>{percent}%</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.heading, { color: theme.accent, lineHeight: 20 }]}>
              {daily.pulseLabel.toUpperCase()}
            </Text>
            <Text style={s.small}>Based on {total.toLocaleString()} Huddle votes.</Text>
          </View>
        </View>
      </View>
      <View style={s.panel}>
        <Text style={s.panelTitle}>
          <Ionicons name="trophy-outline" color="#ffbf33" size={20} /> HUDDLE RESULTS
        </Text>
        <View style={s.metrics}>
          {[
            [compactCount(daily.metrics.comments), 'Comments'],
            [compactCount(daily.metrics.fans), 'Fans participated'],
            [daily.metrics.polls, 'Polls'],
            ...(daily.finalRecord ? [[daily.finalRecord, 'Final record after this game']] : []),
          ].map(([n, l]) => (
            <View key={l} style={s.metric}>
              <Text style={s.number}>{n}</Text>
              <Text style={[s.small, { textAlign: 'center' }]}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
      {top && (
        <View style={s.panel}>
          <Text style={s.panelTitle}>
            <Ionicons name="stats-chart" color={theme.accent} size={20} /> TOP POLL FROM THIS HUDDLE
          </Text>
          <ArchivePoll poll={top} team={daily.team} />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    backgroundColor: '#03151d',
    borderWidth: 1,
    borderColor: '#23414c',
    borderRadius: 8,
    overflow: 'hidden',
  },
  panelTitle: {
    fontFamily: 'BarlowCondensedSemiBold',
    fontSize: 17,
    color: 'white',
    padding: 12,
    backgroundColor: '#081c25',
  },
  pulse: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  percent: { fontFamily: 'BarlowCondensedItalic', fontSize: 52, color: 'white' },
  heading: { fontFamily: 'BarlowCondensedSemiBold', fontSize: 19, color: 'white', marginBottom: 8 },
  small: { fontFamily: 'BarlowCondensedRegular', fontSize: 14, lineHeight: 17, color: '#a9bfca' },
  metrics: { flexDirection: 'row', padding: 12 },
  metric: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  number: { fontFamily: 'BarlowCondensed', fontSize: 28, color: 'white' },
  poll: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  track: {
    flex: 1,
    backgroundColor: '#09212b',
    borderWidth: 1,
    borderColor: '#193844',
    borderRadius: 5,
    overflow: 'hidden',
    minHeight: 34,
  },
  option: { fontFamily: 'BarlowCondensedSemiBold', fontSize: 16, color: 'white', padding: 5 },
});
