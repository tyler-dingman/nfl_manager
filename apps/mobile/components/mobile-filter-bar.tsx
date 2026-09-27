import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeFilterCount,
  filterLabel,
  filterValue,
  resetFilters,
  type MobileFilterProps,
  type FilterValues,
} from '../../../packages/filters';

export function MobileFilterBar({ primary, secondary, values, onChange }: MobileFilterProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<FilterValues>({});
  const insets = useSafeAreaInsets();
  const count = activeFilterCount(secondary, values);
  const fields = open === 'secondary' ? secondary : primary.filter((f) => f.key === open);
  return (
    <View style={s.bar}>
      {primary.map((field, index) => (
        <Pressable
          key={field.key}
          style={[s.trigger, index === 1 && s.grow]}
          accessibilityRole="button"
          accessibilityLabel={`${field.label}: ${filterLabel(field, values)}`}
          accessibilityState={{ expanded: open === field.key }}
          onPress={() => setOpen(field.key)}
        >
          <Text numberOfLines={1} style={s.triggerText}>
            {filterLabel(field, values).toUpperCase()}
          </Text>
          <Feather name="chevron-down" size={14} color="#00172b" />
        </Pressable>
      ))}
      {!!secondary.length && (
        <Pressable
          style={s.trigger}
          accessibilityRole="button"
          accessibilityLabel={`Filters${count ? `, ${count} active` : ''}`}
          onPress={() => {
            setDraft(Object.fromEntries(secondary.map((f) => [f.key, filterValue(f, values)])));
            setOpen('secondary');
          }}
        >
          <Text style={s.triggerText}>FILTERS{count ? ` · ${count}` : ''}</Text>
          <Feather name="sliders" size={15} color="#00172b" />
        </Pressable>
      )}
      <Modal
        visible={!!open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <View style={s.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Dismiss filters"
            onPress={() => setOpen(null)}
          />
          <View
            accessibilityViewIsModal
            style={[
              s.sheet,
              {
                paddingBottom: Math.max(12, insets.bottom),
                marginTop: insets.top,
                paddingLeft: Math.max(16, insets.left),
                paddingRight: Math.max(16, insets.right),
              },
            ]}
          >
            <View style={s.header}>
              <Text accessibilityRole="header" style={s.title}>
                {open === 'secondary' ? 'Filters' : fields[0]?.label}
              </Text>
              <Pressable
                style={s.close}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setOpen(null)}
              >
                <Feather name="x" size={20} />
              </Pressable>
            </View>
            <ScrollView>
              {fields.map((field) => (
                <View key={field.key}>
                  <Text style={s.legend}>{field.label.toUpperCase()}</Text>
                  {field.options.map((option) => {
                    const selected =
                      filterValue(field, open === 'secondary' ? draft : values) === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[s.option, selected && s.selected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          if (open === 'secondary')
                            setDraft((d) => ({ ...d, [field.key]: option.value }));
                          else {
                            onChange({ [field.key]: option.value });
                            setOpen(null);
                          }
                        }}
                      >
                        <Text style={s.optionText}>{option.label}</Text>
                        {selected && <Feather name="check" size={18} color="#00172b" />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            {open === 'secondary' && (
              <View style={s.footer}>
                <Pressable
                  style={s.action}
                  accessibilityRole="button"
                  onPress={() => setDraft(resetFilters(secondary))}
                >
                  <Text style={s.actionText}>Reset</Text>
                </Pressable>
                <Pressable
                  style={[s.action, s.apply]}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(draft);
                    setOpen(null);
                  }}
                >
                  <Text style={[s.actionText, { color: '#fff' }]}>Apply</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    backgroundColor: '#f4f6f8',
    borderBottomWidth: 1,
    borderBottomColor: '#00172b20',
  },
  trigger: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 5,
    borderRadius: 8,
    flexShrink: 1,
  },
  grow: { flex: 1 },
  triggerText: { fontSize: 11, lineHeight: 12, fontWeight: '900', color: '#00172b', flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: '#00172b80', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#00172b20',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '900', color: '#00172b' },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  legend: { fontSize: 12, fontWeight: '800', color: '#52677c', marginTop: 12, marginBottom: 8 },
  option: {
    minHeight: 48,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#00172b15',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: { fontSize: 15, fontWeight: '700', color: '#00172b' },
  selected: { backgroundColor: '#f4f6f8', borderRadius: 8 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#00172b20',
  },
  action: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#00172b30',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apply: { backgroundColor: '#00172b' },
  actionText: { fontWeight: '800', color: '#00172b' },
});
