import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTeamBranding } from '../lib/team-branding';
import {
  getAccessibleTeamPickColor,
  getEditorialHeroTheme,
} from '../../../src/lib/team-theme-tokens';

/** Native renderer for the mobile-web account hero and light editorial page heading. */
export function PageHeading({
  eyebrow,
  title,
  description,
  dark = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  dark?: boolean;
  children?: ReactNode;
}) {
  const { teamId, theme } = useTeamBranding();
  return (
    <View style={[s.header, dark && s.dark]}>
      {dark && <View pointerEvents="none" style={[s.stripe, { backgroundColor: theme.primary }]} />}
      <Text
        style={[
          s.eyebrow,
          {
            color: dark
              ? getEditorialHeroTheme(teamId).heroPrimaryAccent
              : getAccessibleTeamPickColor(teamId),
          },
        ]}
      >
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" style={[s.title, dark && s.light]}>
        {title}
      </Text>
      {description && <Text style={[s.copy, dark && s.darkCopy]}>{description}</Text>}
      {children}
    </View>
  );
}
export function PageState({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <View style={s.state}>
      <Text accessibilityRole="header" style={s.stateTitle}>
        {title}
      </Text>
      {message && <Text style={s.copy}>{message}</Text>}
      {children}
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#00172B18',
    marginBottom: 20,
    overflow: 'hidden',
  },
  dark: { backgroundColor: '#001222', borderRadius: 16, padding: 24, borderBottomWidth: 0 },
  stripe: {
    position: 'absolute',
    right: -20,
    top: -30,
    width: 60,
    height: 300,
    transform: [{ rotate: '35deg' }],
    opacity: 0.1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: '#00172B',
    fontSize: 36,
    lineHeight: 40,
    fontFamily: 'BarlowCondensedItalic',
    textTransform: 'uppercase',
  },
  light: { color: 'white' },
  copy: { color: '#607B98', fontSize: 14, lineHeight: 22, marginTop: 10 },
  darkCopy: { color: '#D5E1ED' },
  state: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#EDF1F5',
    borderRadius: 16,
    padding: 24,
    marginVertical: 16,
  },
  stateTitle: { color: '#00172B', fontWeight: '800', fontSize: 20 },
});
