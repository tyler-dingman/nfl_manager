import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
/** Decorative only: the thumbnail's parent owns the accessible play action. */
export function VideoPlayOverlay({ compact = false }: { compact?: boolean }) {
  const size = compact ? 28 : 44;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[
        s.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
        },
      ]}
    >
      <Ionicons name="play" size={compact ? 14 : 22} color="white" style={{ marginLeft: 2 }} />
    </View>
  );
}
const s = StyleSheet.create({
  circle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderWidth: 1,
    borderColor: 'white',
    backgroundColor: '#0008',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
