import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEditorialHeroTheme } from '../../../src/lib/team-theme-tokens';
import { editorialDesign as D } from '../../../packages/design/mobile';
import { useTeam } from '../lib/team-context';

export function EditorialHero({
  first,
  accent,
  tagline,
  children,
}: {
  first: string;
  accent: string;
  tagline: string;
  children?: ReactNode;
}) {
  const { teamId } = useTeam();
  const colors = getEditorialHeroTheme(teamId);
  return (
    <View style={s.hero}>
      <View
        pointerEvents="none"
        style={[s.stripe, { backgroundColor: colors.heroPrimaryAccent }]}
      />
      <Text accessibilityRole="header" style={s.title}>
        {first} <Text style={{ color: colors.heroPrimaryAccent }}>{accent}</Text>
      </Text>
      <Text style={s.tagline}>{tagline}</Text>
      {children}
    </View>
  );
}
export function NumberedBriefing({
  title,
  items,
  empty = 'New updates will appear here.',
}: {
  title: string;
  items: { id: string; title: string; onPress: () => void }[];
  empty?: string;
}) {
  const { teamId } = useTeam();
  const { heroBrightAccent } = getEditorialHeroTheme(teamId);
  return (
    <View style={s.briefing}>
      <Text style={s.section}>{title}</Text>
      <Text style={[s.subtitle, { color: heroBrightAccent }]}>THE 3 THINGS YOU NEED TO KNOW</Text>
      {items.slice(0, 3).map((item, index) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={item.onPress} style={s.row}>
          <View style={[s.number, { borderColor: heroBrightAccent }]}>
            <Text style={s.digit}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
          <Text numberOfLines={2} style={s.story}>
            {item.title}
          </Text>
          <Ionicons name="chevron-forward" size={17} color="white" />
        </Pressable>
      ))}
      {!items.length && <Text style={s.empty}>{empty}</Text>}
    </View>
  );
}
const s = StyleSheet.create({
  hero: { backgroundColor: D.background, padding: 20, overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: -80,
    right: 0,
    width: 65,
    height: 480,
    opacity: 0.09,
    transform: [{ rotate: '35deg' }],
  },
  title: {
    color: 'white',
    fontSize: 52,
    lineHeight: 56,
    textTransform: 'uppercase',
    fontFamily: 'BarlowCondensedItalic',
    letterSpacing: -1.5,
  },
  tagline: {
    color: 'white',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  briefing: { marginTop: 26 },
  section: { fontSize: 26, lineHeight: 30, fontFamily: 'BarlowCondensed', color: 'white' },
  subtitle: { fontSize: 11, fontWeight: '800', marginTop: 3, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 66,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: D.border,
  },
  number: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 22 },
  story: { flex: 1, color: 'white', fontSize: 14, lineHeight: 19 },
  empty: { color: D.muted, paddingVertical: 20, lineHeight: 20 },
});
