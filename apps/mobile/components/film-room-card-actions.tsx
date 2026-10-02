import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function FilmRoomCardActions({
  onYoutube,
  onShare,
  onChannel,
}: {
  onYoutube: () => void;
  onShare: () => void;
  onChannel: () => void;
}) {
  return (
    <View style={s.row}>
      {(
        [
          ['YOUTUBE', 'external-link', onYoutube],
          ['SHARE', 'share-2', onShare],
          ['CHANNEL', 'external-link', onChannel],
        ] as const
      ).map(([label, icon, action], index) => (
        <Pressable
          key={label}
          accessibilityRole={label === 'SHARE' ? 'button' : 'link'}
          accessibilityLabel={label === 'SHARE' ? 'Share with the Crew' : label}
          onPress={action}
          style={({ pressed }) => [s.action, index > 0 && s.divider, pressed && s.pressed]}
        >
          <Feather name={icon} size={20} color="#071c49" />
          <Text numberOfLines={1} style={s.label}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', marginHorizontal: 8, marginTop: 4 },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 3,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  divider: { borderLeftWidth: 1, borderColor: '#e2e8f0' },
  pressed: { backgroundColor: '#fff1f2' },
  label: { color: '#071c49', fontSize: 11, fontWeight: '700', letterSpacing: 0.44, lineHeight: 13.2 },
});
