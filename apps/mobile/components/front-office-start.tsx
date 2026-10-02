import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { TEAM_LIST } from '../../../src/data/teams';
import { beatPalette } from '../../../src/components/beat/beat-model';
import { gameDayHeroAsset } from '../../../src/config/game-day-hero';
import type { FrontOfficePath } from '../../../src/types/front-office';
import { API_BASE_URL } from '../lib/network';
import { teamLogoAssets } from '../lib/team-logo-assets';
import { useTeamBranding } from '../lib/team-branding';
// Lucide icon geometry (ISC), shared with the web landing page.
function ExperienceIcon({ draft = false, size = 36 }: { draft?: boolean; size?: number }) {
  return (
    <Svg
      style={{ flexShrink: 0, zIndex: 1 }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F7FAFC"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {draft ? (
        <>
          <Path d="m12.99 6.74 1.93 3.44M19.136 12a10 10 0 0 1-14.271 0m16.135 9-2.16-3.84M3 21l8.02-14.26" />
          <Circle cx={12} cy={5} r={2} />
        </>
      ) : (
        <>
          <Path d="m11 17 2 2a1 1 0 1 0 3-3m-2-2 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4m0-1 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8" />
        </>
      )}
    </Svg>
  );
}
function CardArt({ accent, secondary }: { accent: string; secondary: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#06222B" />
            <Stop offset="1" stopColor="#021016" />
          </LinearGradient>
          <Pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <Path d="M24 0H0V24" fill="none" stroke="#AFC5D3" strokeOpacity={0.05} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#panel)" />
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          right: -95,
          bottom: -170,
          width: 170,
          height: 470,
          transform: [{ rotate: '44deg' }],
          opacity: 0.65,
          flexDirection: 'row',
        }}
      >
        <View style={{ width: 17 }} />
        <View style={{ width: 25.5, backgroundColor: accent }} />
        <View style={{ width: 11.9, backgroundColor: '#001219' }} />
        <View style={{ width: 35.7, backgroundColor: secondary }} />
        <View style={{ width: 10.2, backgroundColor: '#001219' }} />
        <View style={{ width: 22.1, backgroundColor: accent }} />
      </View>
    </View>
  );
}
export function NativeFrontOfficeStart({
  teamId,
  busy,
  onStart,
}: {
  teamId: string;
  busy: boolean;
  onStart: (path: FrontOfficePath) => void;
}) {
  const { theme } = useTeamBranding();
  const team = TEAM_LIST.find((t) => t.abbr === teamId),
    accent = beatPalette(teamId).accent;
  return (
    <View testID="front-office-start">
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: -16, right: -16, height: 300, opacity: 0.16 }}
      >
        <Image
          source={
            teamId === 'KC'
              ? require('../../../public/images/gameday/stadium/kc/gameday.png')
              : { uri: API_BASE_URL + gameDayHeroAsset(teamId) }
          }
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
      <View style={s.intro}>
        <Text style={s.ghost}>{teamId}</Text>
        <Text style={s.eyebrow}>FRONT OFFICE · {team?.name.toUpperCase() ?? teamId}</Text>
        <Text style={s.title}>
          Take control of the {team?.name.replace(`${team.city} `, '') ?? teamId}.
        </Text>
        <Text style={s.copy}>
          The decisions are yours. Build the roster, manage the cap, navigate the draft, and shape
          the future of the franchise.
        </Text>
      </View>
      <View style={[s.card, s.full, { borderColor: accent }]}>
        <CardArt accent={accent} secondary={theme.secondary} />
        <Image
          pointerEvents="none"
          source={teamLogoAssets[teamId]}
          contentFit="contain"
          style={{
            position: 'absolute',
            right: -40,
            top: 35,
            width: 230,
            height: 250,
            opacity: 0.08,
          }}
        />
        <Text style={[s.recommended, { color: accent }]}>★ RECOMMENDED</Text>
        <Text style={s.fullTitle}>FULL EXPERIENCE</Text>
        <Text style={s.copy}>
          Take control from Week 1 and manage every decision throughout the season.
        </Text>
        <View style={s.features}>
          {[
            'Weekly decisions',
            'Trades',
            'Free Agency',
            'NFL Draft',
            'Player Development',
            'Ownership',
          ].map((feature) => (
            <View key={feature} style={s.feature}>
              <View style={{ backgroundColor: accent, borderRadius: 4, padding: 2 }}>
                <Feather name="check" color="#03151C" size={13} />
              </View>
              <Text style={{ fontSize: 13, color: '#E2E8F0', flex: 1 }}>{feature}</Text>
            </View>
          ))}
        </View>
        <Pressable
          disabled={busy}
          onPress={() => onStart('full')}
          style={[s.primary, { backgroundColor: theme.primaryFill, opacity: busy ? 0.5 : 1 }]}
        >
          <Text style={[s.buttonText, { color: theme.onPrimary }]}>
            START THE {new Date().getFullYear()} SEASON
          </Text>
          <Feather name="arrow-right" color={theme.onPrimary} size={22} />
        </Pressable>
      </View>
      <Text style={s.section}>OR JUMP INTO A SPECIFIC EXPERIENCE</Text>
      {(
        [
          {
            path: 'free_agency',
            title: 'FREE AGENCY',
            kicker: 'BUILD THE ROSTER',
            copy: 'Enter the offseason free-agent market with your current roster and cap situation.',
            cta: 'START FREE AGENCY',
          },
          {
            path: 'draft',
            title: 'NFL DRAFT',
            kicker: 'BUILD THE FUTURE',
            copy: 'Take control of your draft board, scouting and selections.',
            cta: 'START THE DRAFT',
          },
        ] as const
      ).map((item) => (
        <View key={item.path} style={[s.card, s.quick]}>
          <CardArt accent={accent} secondary={theme.secondary} />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', right: -20, bottom: 4, opacity: 0.055 }}
          >
            <ExperienceIcon draft={item.path === 'draft'} size={190} />
          </View>
          <ExperienceIcon draft={item.path === 'draft'} />
          <View style={{ flex: 1 }}>
            <Text style={s.quickTitle}>{item.title}</Text>
            <Text style={s.kicker}>{item.kicker}</Text>
            <Text style={s.quickCopy}>{item.copy}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onStart(item.path)}
              style={s.quickAction}
            >
              <Text style={[s.buttonText, { color: accent }]}>{item.cta}</Text>
              <Feather name="arrow-right" color={accent} size={20} />
            </Pressable>
          </View>
        </View>
      ))}
      <Text style={s.section}>THE FRANCHISE LIFECYCLE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
      >
        {(
          [
            { title: 'Season', detail: 'Weeks 1–18', icon: 'calendar' },
            { title: 'Playoffs', detail: 'Win the Super Bowl', icon: 'award' },
            { title: 'Combine', detail: 'Evaluate talent', icon: 'search' },
            { title: 'Free Agency', detail: 'Build the roster', icon: 'file-text' },
            { title: 'Draft', detail: 'Add the next generation', icon: 'edit-3' },
            { title: 'Next Season', detail: 'Keep building', icon: 'trending-up' },
          ] as const
        ).map((item) => (
          <View
            key={item.title}
            style={{ width: 145, flexDirection: 'row', gap: 10, alignItems: 'center' }}
          >
            <Feather name={item.icon} color="#F7FAFC" size={24} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'BarlowCondensed', fontSize: 17, color: 'white' }}>
                {item.title.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 10, color: '#8CA5B5', marginTop: 4 }}>{item.detail}</Text>
            </View>
            <Feather name="chevron-right" color="white" size={12} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  intro: { paddingBottom: 22 },
  ghost: {
    position: 'absolute',
    right: 0,
    top: 45,
    fontFamily: 'BarlowCondensedItalic',
    fontSize: 110,
    color: '#FFFFFF0E',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2.7,
    color: '#AFC5D3',
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  title: { fontFamily: 'BarlowCondensed', fontSize: 42, lineHeight: 45, color: '#F7FAFC' },
  copy: { fontSize: 16, lineHeight: 23, color: '#AFC5D3', marginTop: 12 },
  card: { borderWidth: 1, borderColor: '#36505B', borderRadius: 14, overflow: 'hidden' },
  full: { borderLeftWidth: 7, paddingHorizontal: 20, paddingVertical: 28 },
  recommended: { fontFamily: 'BarlowCondensed', fontSize: 16 },
  fullTitle: { fontFamily: 'BarlowCondensed', fontSize: 45, color: '#F7FAFC', marginTop: 12 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20, marginBottom: 23 },
  feature: { width: '47%', flexDirection: 'row', gap: 10, alignItems: 'center' },
  primary: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonText: { fontFamily: 'BarlowCondensed', fontSize: 20 },
  section: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 2.7,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  quick: { padding: 22, flexDirection: 'row', gap: 20, marginBottom: 16 },
  quickTitle: { fontFamily: 'BarlowCondensed', fontSize: 28, color: '#F7FAFC' },
  kicker: {
    fontFamily: 'BarlowCondensed',
    fontSize: 14,
    letterSpacing: 2,
    color: '#AFC5D3',
    marginTop: 3,
  },
  quickCopy: { fontSize: 14, lineHeight: 21, color: '#AFC5D3', marginTop: 12 },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 22,
    minHeight: 44,
  },
});
