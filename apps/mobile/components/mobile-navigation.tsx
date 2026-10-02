import { HeaderIcon } from './header-icon';
import { TeamBrandedLogo } from './team-branded-logo';
import { MobileMenuContent } from './mobile-menu-content';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamBranding } from '../lib/team-branding';
import { getUnreadNotificationCount } from '../lib/api';

export const destinations: { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href }[] = [
  { label: 'Home', icon: 'home-outline', href: '/' },
  { label: 'Three and Out', icon: 'podium-outline', href: '/three' },
  { label: 'The Beat', icon: 'newspaper-outline', href: '/wire' },
  { label: 'The Huddle', icon: 'chatbubbles-outline', href: '/huddle' as Href },
  { label: 'Film Room', icon: 'play-circle-outline', href: '/film-room' as Href },
  { label: 'The Crew', icon: 'people-outline', href: '/crew' as Href },
  { label: 'Trivia', icon: 'help-circle-outline', href: '/trivia' },
  { label: 'Game Day', icon: 'football-outline', href: '/game-day' },
  { label: 'Get Caught Up', icon: 'time-outline', href: '/catch-up' },
  { label: 'Front Office', icon: 'briefcase-outline', href: '/front-office' },
  { label: 'Parlay Lab', icon: 'git-network-outline', href: '/parlay-lab' as Href },
  { label: 'Merch', icon: 'shirt-outline', href: '/merch' },
  { label: 'Rewards', icon: 'trophy-outline', href: '/rewards' },
  { label: 'Saved', icon: 'bookmark-outline', href: '/saved' },
  { label: 'Account', icon: 'person-outline', href: '/account' },
  { label: 'Choose Team', icon: 'shield-outline', href: '/team-select' },
];

export function MobileHeaderActions({ round = false }: { round?: boolean } = {}) {
  const router = useRouter();
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
        style={[
          s.headerAction,
          round && {
            borderWidth: 1,
            borderColor: '#FFFFFFB3',
            borderRadius: 24,
            width: 40,
            height: 40,
          },
        ]}
      >
        <HeaderIcon name="search" />
      </Pressable>
      <Pressable
        accessibilityLabel={`${count} unread notifications`}
        hitSlop={8}
        onPress={() => router.push('/notifications' as Href)}
        style={[
          s.headerAction,
          round && {
            borderWidth: 1,
            borderColor: '#FFFFFFB3',
            borderRadius: 24,
            width: 40,
            height: 40,
          },
        ]}
      >
        <HeaderIcon name="bell" />
        {count ? (
          <View style={[s.badge, { backgroundColor: '#FF3D38' }]}>
            <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function MobileMenuButton({ round = false }: { round?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { theme } = useTeamBranding();

  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.88, 380);
  const openMenu = () => {
    closing.current = false;
    progress.setValue(0);
    setOpen(true);
  };
  const closeMenu = (afterClose?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setOpen(false);
        afterClose?.();
      }
    });
  };
  const navigate = (href: Href) => closeMenu(() => router.push(href));

  return (
    <>
      <Pressable
        accessibilityLabel="Open navigation menu"
        accessibilityRole="button"
        hitSlop={10}
        onPress={openMenu}
        style={[
          s.menuButton,
          round && {
            borderWidth: 1,
            borderColor: '#FFFFFF66',
            borderRadius: 24,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <HeaderIcon name="menu" />
      </Pressable>
      <Modal
        animationType="none"
        onRequestClose={() => closeMenu()}
        transparent
        visible={open}
        onShow={() =>
          Animated.timing(progress, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start()
        }
      >
        <View style={s.overlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
            <Pressable
              accessibilityLabel="Close navigation menu"
              onPress={() => closeMenu()}
              style={s.scrim}
            />
          </Animated.View>
          <Animated.View
            style={[
              s.drawer,
              {
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [drawerWidth, 0],
                    }),
                  },
                ],
              },
              {
                backgroundColor: theme.dark,
                paddingTop: Math.max(20, insets.top),
                paddingBottom: Math.max(20, insets.bottom),
                paddingRight: insets.right,
              },
            ]}
          >
            <MobileMenuContent close={() => closeMenu()} navigate={navigate} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

export function MobileHeaderLogo() {
  const pathname = usePathname();
  const { teamId } = useTeamBranding();
  return (
    <TeamBrandedLogo
      accessibilityLabel={`${teamId} Down & Distance`}
      team={teamId}
      letteringColor={pathname.startsWith('/merch') ? '#FFFFFF' : undefined}
      style={s.headerLogo}
    />
  );
}

const s = StyleSheet.create({
  menuButton: { paddingHorizontal: 16, paddingVertical: 8 },
  headerLogo: { width: 112, height: 56, marginVertical: 3 },
  overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.48)' },
  drawer: { width: '88%', maxWidth: 380, height: '100%', backgroundColor: '#081824' },
  drawerHeader: {
    minHeight: 112,
    paddingTop: 12,
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
  headerActions: { flexDirection: 'row', gap: 8 },
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
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
});
