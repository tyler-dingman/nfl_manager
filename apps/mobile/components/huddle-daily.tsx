import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { gameDayHeroAsset } from '../../../src/config/game-day-hero';
import { API_BASE_URL } from '../lib/network';
import { teamLogoAssets } from '../lib/team-logo-assets';
import {
  compactCount,
  dailyDate,
  pollResult,
  type DailyHuddle,
} from '../../../packages/huddle/daily';
import type { Message, Poll } from '../../../packages/huddle';
import { getOnboardingTheme } from '../lib/onboarding-theme';
export function DailyHero({ daily, onJoin }: { daily: DailyHuddle; onJoin: () => void }) {
  const theme = getOnboardingTheme(daily.team);
  const wide = useWindowDimensions().width >= 900;
  const archived = daily.status === 'ARCHIVED';
  return (
    <View style={[s.hero, wide && { flexDirection: 'row', alignItems: 'center', gap: 0 }]}>
      <Image
        source={
          daily.team === 'KC'
            ? require('../../../public/images/gameday/stadium/kc/gameday.png')
            : { uri: API_BASE_URL + gameDayHeroAsset(daily.team) }
        }
        style={[StyleSheet.absoluteFill, { opacity: 0.15 }]}
        contentFit="cover"
      />
      <View style={[s.heading, wide && { width: '50%', paddingRight: 32 }]}>
        <Image
          source={teamLogoAssets[daily.team]}
          style={{ width: wide ? 92 : 60, height: wide ? 92 : 60 }}
          contentFit="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, wide && { fontSize: 64 }]}>
            THE <Text style={{ color: theme.primaryCTA }}>HUDDLE</Text>
          </Text>
          <Text style={s.body}>{daily.description}</Text>
          {archived && (
            <Text style={[s.small, { marginTop: 10 }]}>
              {compactCount(daily.metrics.fans)} fans participated ·{' '}
              {compactCount(daily.metrics.comments)} comments · {daily.metrics.polls} polls
            </Text>
          )}
        </View>
      </View>
      <View
        style={[
          s.heroDetails,
          wide && {
            width: '50%',
            borderTopWidth: 0,
            borderLeftWidth: 1,
            paddingLeft: archived ? 24 : 32,
            paddingTop: 0,
            marginTop: 0,
          },
        ]}
      >
        {archived ? (
          <View style={{ alignItems: 'flex-start', gap: 14 }}>
            <View
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: '#294c58',
                borderRadius: 8,
                backgroundColor: '#061b26',
                flexDirection: 'row',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <Ionicons name="time-outline" size={28} color="white" />
              <View>
                <Text style={s.label}>PAST HUDDLE</Text>
                <Text style={s.body}>{dailyDate(daily.date)}</Text>
              </View>
            </View>
            <Text style={[s.summary, { fontFamily: 'BarlowCondensedItalic' }]}>{daily.summary}</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/huddle', params: { team: daily.team } })}
              style={[
                s.join,
                { backgroundColor: theme.primaryCTA },
              ]}
            >
              <Text style={[s.label, { color: theme.onPrimary }]}>Join Today’s Huddle →</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[s.small, { letterSpacing: 2 }]}>
              {dailyDate(daily.date).toUpperCase()}
            </Text>
            <Text style={[s.summary, { fontFamily: 'BarlowCondensedItalic' }]}>
              {daily.summary}
            </Text>
            <View style={s.joinMeta}>
              <View style={{ flexDirection: 'row' }}>
                {['CM', 'RF', 'A4'].map((x) => (
                  <View key={x} style={s.miniAvatar}>
                    <Text style={s.small}>{x}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.small}>
                <Text style={{ color: '#00cf91' }}>● </Text>
                {compactCount(daily.metrics.hereNow)} IN THE HUDDLE
              </Text>
              <Text style={s.small}>· {compactCount(daily.metrics.comments)} comments today</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onJoin}
              style={[s.join, { backgroundColor: theme.primaryCTA }]}
            >
              <Text style={[s.label, { color: theme.onPrimary }]}>Join the Huddle →</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
export function DailyUpdate({
  entry,
  accent,
  archived = false,
}: {
  entry: Message;
  accent: string;
  archived?: boolean;
}) {
  return (
    <View style={[s.system, { borderLeftColor: accent }]}>
      <View style={[s.badge, { borderColor: accent }]}>
        <Text style={s.label}>D&D</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.systemLabel}>
          D&D UPDATE{' '}
          <Text style={s.small}>
            {' '}
            ·{' '}
            {new Date(entry.at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/Chicago',
            })}
          </Text>
        </Text>
        <Text style={s.body}>{entry.body}</Text>
        {archived && (
          <Text style={s.small}>
            <Ionicons name="thumbs-up-outline" size={14} color="white" /> {entry.likes}
          </Text>
        )}
      </View>
      <Ionicons name="pin-outline" size={20} color={accent} />
    </View>
  );
}
export function DailyPoll({
  poll,
  choice,
  onVote,
  team,
}: {
  poll: Poll;
  choice?: number;
  onVote: (i: number) => void;
  team: string;
}) {
  const theme = getOnboardingTheme(team),
    { total } = pollResult(poll);
  return (
    <View style={[s.system, { borderLeftColor: theme.primaryCTA }]}>
      <View style={[s.badge, { backgroundColor: theme.primaryCTA, borderColor: theme.primaryCTA }]}>
        <Ionicons name="stats-chart" size={22} color={theme.onPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.systemLabel}>HUDDLE POLL</Text>
        <Text style={s.label}>{poll.question}</Text>
        <View style={s.pollBar}>
          {poll.options.map((o, i) => (
            <Pressable
              key={o}
              accessibilityRole="button"
              accessibilityState={{
                selected: choice === i,
                disabled: poll.closed || choice !== undefined,
              }}
              disabled={poll.closed || choice !== undefined}
              onPress={() => onVote(i)}
              style={{
                flex: Math.max(poll.counts[i] ?? 0, 1),
                padding: 7,
                minHeight: 40,
                justifyContent: 'center',
                backgroundColor: i === 0 ? theme.primaryCTA : '#20323d',
              }}
            >
              <Text
                style={[
                  s.label,
                  { textAlign: 'center', color: i === 0 ? theme.onPrimary : 'white' },
                ]}
              >
                {total ? Math.round(((poll.counts[i] ?? 0) / total) * 100) : 0}% {o.toUpperCase()}
                {choice === i ? ' ✓' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.small}>
          {total.toLocaleString()} votes{choice !== undefined ? ' · Preview selection only' : ''}
        </Text>
      </View>
    </View>
  );
}
export function DailyCommunity({
  daily,
  polls,
  onPoll,
}: {
  daily: DailyHuddle;
  polls: Poll[];
  onPoll: () => void;
}) {
  const theme = getOnboardingTheme(daily.team),
    featured = polls.find((p) => p.id === daily.featuredPollId),
    result = pollResult(featured),
    { width } = useWindowDimensions();
  return (
    <View style={s.community}>
      <View style={s.panel}>
        <Text style={s.panelHeading}>
          <Ionicons name="stats-chart" size={18} color={theme.accent} /> HUDDLE PULSE
        </Text>
        <Pressable accessibilityRole="button" onPress={onPoll} style={s.pulse}>
          <Text style={s.percent}>{result.percent}%</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: theme.accent, lineHeight: 18 }]}>
              {daily.pulseLabel.toUpperCase()}
            </Text>
            <Text style={s.small}>Based on {result.total.toLocaleString()} Huddle votes.</Text>
          </View>
          <Ionicons name="chevron-forward" color="white" size={18} />
        </Pressable>
      </View>
      <View style={s.panel}>
        <Text style={s.panelHeading}>
          <Ionicons name="people-outline" size={18} color={theme.accent} /> TODAY IN THE HUDDLE
        </Text>
        <View style={s.metrics}>
          {[
            [daily.metrics.hereNow, 'Here now'],
            [daily.metrics.comments, 'Comments today'],
            [daily.metrics.fans, 'Fans participated'],
            [daily.metrics.polls, 'Polls'],
          ].map(([n, l]) => (
            <View
              key={l}
              style={{
                width: width < 360 ? '50%' : '25%',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 3,
              }}
            >
              <Text style={s.metric}>{compactCount(Number(n))}</Text>
              <Text style={[s.small, { textAlign: 'center' }]}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.panel}>
        <View style={s.archiveHeading}>
          <Text style={s.panelHeading}>
            <Ionicons name="time-outline" size={18} color={theme.accent} /> PREVIOUS HUDDLES
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              router.push({ pathname: '/huddle-archive', params: { team: daily.team } })
            }
          >
            <Text style={[s.label, { color: theme.accent }]}>View All →</Text>
          </Pressable>
        </View>
        {daily.previous.slice(0, 3).map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="link"
            style={s.archive}
            onPress={() =>
              router.push({
                pathname: '/huddle-archive',
                params: { team: daily.team, date: p.date },
              })
            }
          >
            <View style={s.badge}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#b9ced8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.body}>The Huddle — {p.summary}</Text>
              <Text style={s.small}>
                {dailyDate(p.date, true)} · {compactCount(p.comments)} comments
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  hero: { padding: 16, backgroundColor: '#001016' },
  heroDetails: { borderTopWidth: 1, borderColor: '#ffffff44', paddingTop: 14, marginTop: 14 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontFamily: 'BarlowCondensedItalic', fontSize: 38, color: 'white' },
  summary: {
    fontFamily: 'BarlowCondensedSemiBold',
    fontSize: 25,
    color: 'white',
    marginVertical: 5,
  },
  body: { fontFamily: 'BarlowCondensedRegular', fontSize: 16, lineHeight: 21, color: '#edf4f8' },
  small: { fontFamily: 'BarlowCondensedRegular', fontSize: 13, lineHeight: 17, color: '#a6bcc7' },
  label: { fontFamily: 'BarlowCondensedSemiBold', fontSize: 17, color: 'white' },
  joinMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: -3,
    backgroundColor: '#315663',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#001016',
  },
  join: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  system: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: '#33505c',
    borderRadius: 7,
    backgroundColor: '#0a202a',
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#33505c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemLabel: {
    color: '#ffbf33',
    fontFamily: 'BarlowCondensedSemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  pollBar: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', marginVertical: 7 },
  community: { gap: 12, marginTop: 20 },
  panel: {
    borderWidth: 1,
    borderColor: '#23414c',
    borderRadius: 8,
    backgroundColor: '#03151d',
    overflow: 'hidden',
  },
  panelHeading: {
    fontFamily: 'BarlowCondensedSemiBold',
    fontSize: 16,
    color: 'white',
    padding: 10,
    backgroundColor: '#081c25',
  },
  pulse: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  percent: { fontFamily: 'BarlowCondensedItalic', fontSize: 48, color: 'white' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { fontFamily: 'BarlowCondensed', fontSize: 24, color: 'white' },
  archiveHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 10,
    backgroundColor: '#081c25',
  },
  archive: { flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center' },
});
