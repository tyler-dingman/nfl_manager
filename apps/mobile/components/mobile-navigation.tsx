import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTeamBranding } from '../lib/team-branding';
import { getUnreadNotificationCount } from '../lib/api';

const destinations: { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href }[] = [
  { label: 'Home', icon: 'home-outline', href: '/' },
  { label: 'Three and Out', icon: 'podium-outline', href: '/three' },
  { label: 'The Beat', icon: 'newspaper-outline', href: '/wire' },
  { label: 'Film Room', icon: 'videocam-outline', href: '/film-room' as Href },
  { label: 'The Crew', icon: 'people-outline', href: '/crew' as Href },
  { label: 'Trivia', icon: 'help-circle-outline', href: '/trivia' },
  { label: 'Game Day', icon: 'football-outline', href: '/game-day' },
  { label: 'Get Caught Up', icon: 'time-outline', href: '/catch-up' },
  { label: 'Front Office', icon: 'briefcase-outline', href: '/front-office' },
  { label: 'Merch', icon: 'shirt-outline', href: '/merch' },
  { label: 'Rewards', icon: 'trophy-outline', href: '/rewards' },
  { label: 'Saved', icon: 'bookmark-outline', href: '/saved' },
  { label: 'Account', icon: 'person-outline', href: '/account' },
  { label: 'Choose Team', icon: 'shield-outline', href: '/team-select' },
];

export function MobileHeaderActions() {
  const router = useRouter();
  const { theme } = useTeamBranding();
  const [count, setCount] = useState(0);
  useEffect(() => {
    void getUnreadNotificationCount()
      .then(setCount)
      .catch(() => setCount(0));
  }, []);
  return (
    <View style={s.headerActions}>
      <Pressable
        accessibilityLabel="Search"
        hitSlop={8}
        onPress={() => router.push('/search')}
        style={s.headerAction}
      >
        <Ionicons name="search" color={theme.light} size={22} />
      </Pressable>
      <Pressable
        accessibilityLabel={`${count} unread notifications`}
        hitSlop={8}
        onPress={() => router.push('/notifications' as Href)}
        style={s.headerAction}
      >
        <Ionicons name="notifications-outline" color={theme.light} size={22} />
        {count ? (
          <View style={[s.badge, { backgroundColor: theme.secondary }]}>
            <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function MobileMenuButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { logoSource, teamId, theme } = useTeamBranding();

  const navigate = (href: Href) => {
    setOpen(false);
    requestAnimationFrame(() => router.push(href));
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Open navigation menu"
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => setOpen(true)}
        style={s.menuButton}
      >
        <Ionicons color={theme.light} name="menu" size={28} />
      </Pressable>
      <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={s.overlay}>
          <Pressable
            accessibilityLabel="Close navigation menu"
            onPress={() => setOpen(false)}
            style={s.scrim}
          />
          <View style={[s.drawer, { backgroundColor: theme.dark }]}>
            <View style={[s.drawerHeader, { borderBottomColor: theme.secondary }]}>
              <Image
                accessibilityLabel={`${teamId} Down & Distance`}
                resizeMode="contain"
                source={logoSource}
                style={s.drawerLogo}
              />
              <Pressable
                accessibilityLabel="Close navigation menu"
                hitSlop={10}
                onPress={() => setOpen(false)}
              >
                <Ionicons color={theme.light} name="close" size={28} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.links}>
              {destinations.map((destination) => (
                <Pressable
                  accessibilityRole="link"
                  key={destination.label}
                  onPress={() => navigate(destination.href)}
                  style={({ pressed }) => [s.link, pressed && s.linkPressed]}
                >
                  <Ionicons color={theme.secondary} name={destination.icon} size={22} />
                  <Text style={[s.linkText, { color: theme.light }]}>{destination.label}</Text>
                  <Ionicons color="#71808C" name="chevron-forward" size={19} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function MobileHeaderLogo() {
  const { logoSource, teamId } = useTeamBranding();
  return (
    <Image
      accessibilityLabel={`${teamId} Down & Distance`}
      resizeMode="contain"
      source={logoSource}
      style={s.headerLogo}
    />
  );
}

const s = StyleSheet.create({
  menuButton: { paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 104, height: 46, marginVertical: 3 },
  overlay: { flex: 1, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.48)' },
  drawer: { width: '84%', maxWidth: 360, height: '100%', backgroundColor: '#081824' },
  drawerHeader: {
    minHeight: 112,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#243541',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drawerLogo: { width: 132, height: 68 },
  links: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 34 },
  link: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 12,
  },
  linkPressed: { backgroundColor: '#152936' },
  linkText: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  headerActions: { flexDirection: 'row', paddingRight: 8 },
  headerAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: 2,
    top: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#081824', fontSize: 9, fontWeight: '900' },
});
