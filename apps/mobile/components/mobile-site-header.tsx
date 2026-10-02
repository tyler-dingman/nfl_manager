import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTeamBranding } from '../lib/team-branding';
import { MobileHeaderActions, MobileHeaderLogo, MobileMenuButton } from './mobile-navigation';

/** Native counterpart of SiteHeaderShell: web's --dark token, logo, then right-hand actions. */
export function MobileSiteHeader({ onBack }: { onBack?: () => void }) {
  const { theme } = useTeamBranding();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: theme.dark }}>
      <View testID="mobile-site-header" style={s.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Down & Distance home"
          onPress={() => router.navigate('/')}
        >
          <MobileHeaderLogo />
        </Pressable>
        <View style={s.actions}>
          <MobileHeaderActions round />
          <MobileMenuButton round />
        </View>
      </View>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={s.back}
        >
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  row: {
    height: 80,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFFFFF26',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  backText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
