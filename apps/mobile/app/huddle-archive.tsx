import { ScrollView, View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Huddle from './huddle';
import { TEAM_LIST } from '../../../src/data/teams';
import { dailyDate, compactCount } from '../../../packages/huddle/daily';
export default function HuddleArchive() {
  const { team = 'KC', date } = useLocalSearchParams<{ team?: string; date?: string }>();
  if (date) return <Huddle archive />;
  const selected = TEAM_LIST.find((t) => t.abbr === team) ?? TEAM_LIST[0],
    daily =
      process.env.NODE_ENV === 'development'
        ? (
            require('../../../packages/huddle/demo-daily') as typeof import('../../../packages/huddle/demo-daily')
          ).dailySnapshot(selected.abbr, selected.name).daily
        : null;
  return (
    <ScrollView
      style={{ backgroundColor: '#001016', flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/huddle', params: { team } })}
      >
        <Text style={{ color: 'white' }}>← Today’s Huddle</Text>
      </Pressable>
      <Text style={{ fontFamily: 'BarlowCondensedItalic', fontSize: 38, color: 'white' }}>
        PREVIOUS HUDDLES
      </Text>
      {daily?.previous.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="link"
          onPress={() =>
            router.push({ pathname: '/huddle-archive', params: { team, date: p.date } })
          }
          style={{
            padding: 16,
            backgroundColor: '#071d27',
            borderWidth: 1,
            borderColor: '#284651',
            borderRadius: 8,
          }}
        >
          <Text style={{ fontFamily: 'BarlowCondensedSemiBold', fontSize: 22, color: 'white' }}>
            The Huddle — {p.summary}
          </Text>
          <Text
            style={{
              fontFamily: 'BarlowCondensedRegular',
              fontSize: 16,
              color: '#afc3cd',
              marginTop: 8,
            }}
          >
            {dailyDate(p.date, true)} · {compactCount(p.comments)} comments →
          </Text>
        </Pressable>
      ))}
      <Text style={{ color: '#afc3cd' }}>
        {daily
          ? 'Archive preview · Sample conversations.'
          : 'Archived Huddles are not available yet.'}
      </Text>
    </ScrollView>
  );
}
