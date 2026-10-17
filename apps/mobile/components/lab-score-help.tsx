import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAB_SCORE_CONFIG, LAB_SCORE_SCALE_NOTE } from '../../../packages/parlay/lab-score-config';
export function LabScoreHelp() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Lab Score Guide"
        onPress={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{ padding: 6, alignSelf: 'flex-start' }}
      >
        <Feather name="info" color="#a8c0cd" size={15} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 20,
            paddingTop: Math.max(20, insets.top),
            paddingBottom: Math.max(20, insets.bottom),
            backgroundColor: '#00121bb3',
          }}
        >
          <View
            accessibilityViewIsModal
            style={{ backgroundColor: '#031923', borderRadius: 12, padding: 20, maxHeight: '90%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontFamily: 'BarlowCondensed', fontSize: 24, color: 'white' }}>
                Lab Score Guide
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Lab Score Guide"
                onPress={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                style={{ padding: 10 }}
              >
                <Feather name="x" size={20} color="white" />
              </Pressable>
            </View>
            <ScrollView>
              {LAB_SCORE_CONFIG.bands.map((t) => (
                <View
                  key={t.min}
                  style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: '#244552' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: 'white' }}>
                    {t.range} · {t.label}
                  </Text>
                  <Text style={{ color: '#a8c0cd', fontSize: 12, marginTop: 5 }}>
                    {t.description}
                  </Text>
                </View>
              ))}
              <Text style={{ color: '#a8c0cd', fontSize: 12, marginTop: 12 }}>
                Research strength, not win probability. {LAB_SCORE_SCALE_NOTE}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
