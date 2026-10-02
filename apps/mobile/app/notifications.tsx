import { PageHeading, PageState } from '../components/page-heading';
import { Feather } from '@expo/vector-icons';
import { useTeamBranding } from '../lib/team-branding';
import { PageScrollView as ScrollView } from '../components/page-scroll-view';
import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getNotifications, updateNotifications, type MobileNotification } from '../lib/api';

import { nativeDestination } from '../lib/native-destination';
export default function NotificationsScreen() {
  const { theme } = useTeamBranding();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState('');
  const [items, setItems] = useState<MobileNotification[]>([]),
    [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await getNotifications()).notifications);
    } catch {
      setError('Unable to load notifications. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    void updateNotifications('seen').catch(() => undefined);
  }, [load]);
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <PageHeading eyebrow="YOUR UPDATES" title="Notifications" />
      <View style={s.header}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['all', 'unread'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)}
              style={{
                minHeight: 44,
                padding: 12,
                borderRadius: 20,
                backgroundColor: filter === value ? theme.primaryFill : '#F1F5F9',
              }}
            >
              <Text
                style={{ color: filter === value ? theme.onPrimary : C.ink, fontWeight: '800' }}
              >
                {value === 'all' ? 'All' : 'Unread'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void updateNotifications('read-all')
              .then(load)
              .catch(() => setError('Unable to mark notifications read.'))
          }
        >
          <Text style={s.readAll}>Mark all read</Text>
        </Pressable>
      </View>
      {error && <PageState title="Notifications unavailable" message={error} />}
      {items
        .filter((item) => filter === 'all' || !item.readAt)
        .map((item) => (
          <Pressable
            key={item.id}
            style={[
              s.card,
              !item.readAt && {
                backgroundColor: '#F1F5F9',
                borderLeftWidth: 4,
                borderLeftColor: theme.primaryFill,
              },
            ]}
            onPress={async () => {
              if (!item.readAt) {
                try {
                  await updateNotifications('read', item.id);
                } catch {
                  setError('Unable to mark notification read.');
                  return;
                }
              }
              const destination = nativeDestination(item.deepLink);
              if (destination) router.push(destination);
              else void load();
            }}
          >
            <View style={s.row}>
              <Text style={s.category}>{item.category.replaceAll('_', ' ')}</Text>
              {!item.readAt ? <View style={s.dot} /> : null}
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.copy}>{item.body}</Text>
            <Text style={s.time}>{new Date(item.createdAt).toLocaleString()}</Text>
          </Pressable>
        ))}
      {!loading && !error && !items.some((item) => filter === 'all' || !item.readAt) ? (
        <View style={s.empty}>
          <Feather name="bell" size={32} color={C.muted} />
          <Text style={s.title}>You’re all caught up.</Text>
          <Text style={s.copy}>New updates will appear here.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 18, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  readAll: { fontSize: 11, fontWeight: '900', color: C.red, paddingVertical: 10 },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 17,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5DED3',
  },
  unread: { borderLeftWidth: 4, borderLeftColor: C.red },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { fontSize: 11, fontWeight: '900', color: C.red, letterSpacing: 1 },
  dot: { height: 9, width: 9, borderRadius: 5, backgroundColor: C.red },
  title: { fontSize: 17, fontWeight: '900', color: C.ink, marginTop: 7 },
  copy: { color: C.muted, lineHeight: 20, marginTop: 5 },
  time: { fontSize: 11, color: C.muted, marginTop: 10 },
  empty: { alignItems: 'center', padding: 32, marginTop: 20 },
});
