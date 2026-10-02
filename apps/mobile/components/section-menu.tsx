import { useState } from 'react';
import { Modal, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export function SectionMenu({
  title,
  items,
  dark = false,
  navigation,
}: {
  dark?: boolean;
  /** Insets of the containing page; navigation alone bleeds to the screen edges. */
  navigation?: { inset: number; top?: boolean; tone?: 'merch' };
  title: string;
  items: { label: string; onPress: () => void; selected?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <View
      style={[
        s.menu,
        navigation && {
          borderRadius: 0,
          marginHorizontal: -navigation.inset,
          marginTop: navigation.top ? -navigation.inset : 0,
          marginBottom: 12,
          backgroundColor: navigation.tone === 'merch' ? '#f4d9b7' : '#f4f6f8',
          borderBottomWidth: 1,
          borderBottomColor: '#00172b20',
        },
        dark && { backgroundColor: '#08232F', borderWidth: 1, borderColor: '#183743' },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[s.row, navigation && s.navigationRow]}
      >
        {navigation && <Ionicons name="menu-outline" size={18} color="#00172b" />}
        <Text style={[s.title, navigation && s.navigationTitle, dark && { color: 'white' }]}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={dark ? 'white' : '#001222'}
        />
      </Pressable>
      {open && !navigation &&
        items.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: item.selected }}
            key={item.label}
            onPress={() => {
              item.onPress();
              setOpen(false);
            }}
            style={s.row}
          >
            <Text style={[s.text, dark && { color: 'white' }]}>{item.label}</Text>
            {item.selected && <Ionicons name="checkmark" size={18} />}
          </Pressable>
        ))}
      {navigation && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
            <Pressable accessibilityLabel="Close section navigation" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
            <View accessibilityViewIsModal style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 16, paddingBottom: 32 }}>
              <View style={s.row}>
                <Text style={s.navigationTitle}>{title}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close section navigation" onPress={() => setOpen(false)} style={{ padding: 12 }}><Ionicons name="close" size={22} color="#00172b" /></Pressable>
              </View>
              <ScrollView>
                {items.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityState={{ selected: item.selected }} onPress={() => { item.onPress(); setOpen(false); }} style={[s.row, { minHeight: 48, borderRadius: 8, backgroundColor: item.selected ? '#f4f6f8' : 'white' }]}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: item.selected ? '#c91530' : '#00172b' }}>{item.label}</Text>
                  {item.selected && <Ionicons name="checkmark" size={20} color="#c91530" />}
                </Pressable>)}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  menu: { backgroundColor: '#FFF4E4', borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  row: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigationRow: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  navigationTitle: { flex: 1, fontSize: 14, color: '#00172b' },
  title: { color: '#001222', fontWeight: '800', fontSize: 13 },
  text: { color: '#001222', fontSize: 14 },
});
