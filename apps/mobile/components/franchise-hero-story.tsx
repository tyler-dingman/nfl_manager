import { heroStoryLabel } from '../../../packages/front-office/hero-story';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import {
  heroBackgroundPosition,
  heroBackgroundScale,
  heroGraphic,
} from '../../../packages/front-office/hero-assets';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HeroStory } from '../../../packages/front-office/hero-story';
import { gameDayHeroAsset } from '../../../src/config/game-day-hero';
import { useTeamBranding } from '../lib/team-branding';
import { API_BASE_URL } from '../lib/network';
const asset = (url: string) => (url.startsWith('/') ? `${API_BASE_URL}${url}` : url);
export function FranchiseHeroStory({
  story,
  onSection,
  onAcknowledge,
}: {
  story: HeroStory;
  onAcknowledge?: (id: string) => void;
  onSection: (section: string, facility?: string, playerId?: string) => void;
}) {
  const { teamId, theme } = useTeamBranding();
  const [failed, setFailed] = useState(false),
    [detail, setDetail] = useState(false);
  const stadium = failed || story.visualType === 'stadium';
  const graphic = failed ? undefined : heroGraphic(story.visualType);
  const image = failed ? gameDayHeroAsset(teamId) : story.image;
  const environment = stadium || Boolean(graphic);
  const focal = heroBackgroundPosition(stadium ? 'stadium' : story.visualType, teamId);
  function open() {
    if (
      story.subjectPlayer &&
      (story.cta !== 'VIEW FREE AGENT' || !story.phase) &&
      ['VIEW PLAYER', 'VIEW FREE AGENT', 'VIEW YOUR NEWEST PLAYER'].includes(story.cta)
    ) {
      setDetail(true);
      return;
    }
    if (story.postActionId) onAcknowledge?.(story.postActionId);
    onSection(
      story.href.includes('ownership')
        ? 'Ownership'
        : story.href.includes('development')
          ? 'Development'
          : story.href.includes('trade')
            ? 'Trades'
            : story.href.includes('draft')
              ? 'Draft'
              : story.href.includes('standings')
                ? 'Standings'
                : story.href.includes('schedule')
                  ? 'Schedule'
                  : story.href.includes('free-agents')
                    ? 'Free Agency'
                    : 'Roster',
      story.href.includes('/ownership/facilities') ? story.href.split('#')[1] : undefined,
      story.subjectId,
    );
  }
  return (
    <>
      <View style={s.hero}>
        {environment && image && (
          <ExpoImage
            source={{ uri: asset(image) }}
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [{ scale: heroBackgroundScale(stadium ? 'stadium' : story.visualType) }],
              },
            ]}
            contentFit="cover"
            contentPosition={{
              left: `${parseFloat(focal.mobilePosition)}%`,
              top: `${parseFloat(focal.mobilePosition.split(' ')[1])}%`,
            }}
            onError={() => setFailed(true)}
          />
        )}
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="heroBlend" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#06141d" stopOpacity=".96" />
              <Stop offset=".45" stopColor="#06141d" stopOpacity=".85" />
              <Stop offset="1" stopColor="#06141d" stopOpacity=".4" />
            </LinearGradient>
            <LinearGradient id="teamBlend" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.primary} stopOpacity=".24" />
              <Stop offset=".5" stopColor={theme.primary} stopOpacity=".14" />
              <Stop offset="1" stopColor={theme.primary} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" fill="url(#heroBlend)" />
          <Polygon points="0,0 52,0 46,100 0,100" fill="url(#teamBlend)" />
        </Svg>
        {!environment && image && (
          <ExpoImage
            source={{ uri: asset(image) }}
            style={s.person}
            contentFit="contain"
            contentPosition="bottom"
            onError={() => setFailed(true)}
          />
        )}
        <View style={s.copy}>
          <Text style={s.week}>{heroStoryLabel(story).toUpperCase()}</Text>
          <Text style={s.title}>{story.headline}</Text>
          {story.simulatedDialogue && <Text style={s.disclosure}>SIMULATED COACH QUOTE</Text>}
          <Text style={[s.body, { maxWidth: environment ? '85%' : '62%' }]} numberOfLines={4}>
            {story.body}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[s.button, { backgroundColor: theme.primary, alignSelf: 'flex-start' }]}
            onPress={open}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{story.cta} →</Text>
          </Pressable>
        </View>
      </View>
      <Modal
        visible={detail}
        animationType="slide"
        onRequestClose={() => {
          setDetail(false);
          if (story.postActionId) onAcknowledge?.(story.postActionId);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#091a20' }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() => {
                setDetail(false);
                if (story.postActionId) onAcknowledge?.(story.postActionId);
              }}
            >
              <Text style={s.body}>Close player details ✕</Text>
            </Pressable>
            {story.image && (
              <Image
                source={{ uri: asset(story.image) }}
                style={{ height: 220, width: '100%' }}
                resizeMode="contain"
              />
            )}
            <Text style={s.title}>{story.subjectName}</Text>
            <Text style={s.body}>{story.subjectDetail}</Text>
            <Text style={s.body}>{story.body}</Text>
            <Text style={s.body}>
              Age {story.subjectPlayer?.age ?? '—'} · Contract{' '}
              {story.subjectPlayer?.contractYearsRemaining ?? '—'} years
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  hero: {
    backgroundColor: '#091a20',
    borderRadius: 5,
    overflow: 'hidden',
    padding: 18,
    minHeight: 330,
    justifyContent: 'center',
    marginVertical: 12,
  },
  week: { color: 'white', fontSize: 11, fontWeight: '700', marginBottom: 10 },
  title: {
    color: 'white',
    fontFamily: 'BarlowCondensed',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    fontSize: 34,
    lineHeight: 36,
  },
  copy: { width: '100%' },
  disclosure: { color: '#a5b6be', fontSize: 10, letterSpacing: 1, marginTop: 10 },
  person: { position: 'absolute', right: -8, bottom: 0, width: '42%', height: '66%' },
  body: { color: '#dce5e8', fontSize: 14, lineHeight: 20, marginVertical: 12 },
  button: { minHeight: 44, padding: 10, borderRadius: 4, justifyContent: 'center' },
});
