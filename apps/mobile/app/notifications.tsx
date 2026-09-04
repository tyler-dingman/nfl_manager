import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getNotifications, updateNotifications, type MobileNotification } from '../lib/api';

const nativeDestination = (value: string | null): Href | null => {
  if (!value) return null;
  if (value.startsWith('/the-beat')) {
    const id = new URL(value, 'https://downanddistance.local').searchParams.get('story');
    return (id ? `/beat-story/${id}` : '/beat') as Href;
  }
  if (value.startsWith('/crew')) return '/crew' as Href;
  if (value.startsWith('/watch')) return '/film-room' as Href;
  if (value.startsWith('/game-day')) return '/game-day';
  if (value.startsWith('/trivia')) return '/trivia';
  if (value.startsWith('/front-office')) return '/front-office';
  return null;
};
export default function NotificationsScreen() {
  const [items, setItems] = useState<MobileNotification[]>([]),
    [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await getNotifications()).notifications);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    void updateNotifications('seen');
  }, [load]);
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {' '}
      <View style={s.header}>
        <View>
          <Eyebrow>YOUR UPDATES</Eyebrow>
          <Heading>Notifications</Heading>
        </View>
        <Pressable
          onPress={async () => {
            await updateNotifications('read-all');
            void load();
          }}
        >
          <Text style={s.readAll}>MARK ALL READ</Text>
        </Pressable>
      </View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={[s.card, !item.readAt && s.unread]}
          onPress={async () => {
            if (!item.readAt) await updateNotifications('read', item.id);
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
      {!loading && !items.length ? <Text style={s.empty}>You’re all caught up.</Text> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
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
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});
