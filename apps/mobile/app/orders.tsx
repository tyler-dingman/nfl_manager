import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCommerceOrders } from '../lib/api';
import { C, Heading } from '../components/screen';
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]),
    [tab, setTab] = useState('ALL');
  useEffect(() => {
    void getCommerceOrders().then(setOrders);
  }, []);
  const visible = orders.filter(
    (o) =>
      tab === 'ALL' ||
      (tab === 'PROCESSING'
        ? ['NEW', 'PICKING', 'PACKED'].includes(o.fulfillment_status)
        : o.fulfillment_status === tab),
  );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <Heading>MY ORDERS</Heading>
      <ScrollView horizontal contentContainerStyle={s.tabs}>
        {['ALL', 'PROCESSING', 'SHIPPED', 'CANCELED'].map((x) => (
          <Pressable key={x} onPress={() => setTab(x)} style={[s.tab, tab === x && s.active]}>
            <Text style={[s.tabText, tab === x && { color: C.white }]}>{x}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {visible.map((o) => (
        <Pressable
          key={o.id}
          style={s.order}
          onPress={() =>
            router.push({ pathname: '/order/[orderId]', params: { orderId: o.id } } as never)
          }
        >
          <View>
            <Text style={s.name}>#{o.order_number}</Text>
            <Text style={s.muted}>{new Date(o.created_at).toLocaleDateString()}</Text>
          </View>
          <View>
            <Text style={s.name}>{money(o.total_cents)}</Text>
            <Text style={s.status}>{o.fulfillment_status}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20 },
  tabs: { gap: 8, paddingVertical: 18 },
  tab: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.white },
  active: { backgroundColor: C.red },
  tabText: { fontWeight: '900', fontSize: 11, color: C.ink },
  order: {
    backgroundColor: C.white,
    borderRadius: 15,
    padding: 17,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: { fontWeight: '900', color: C.ink },
  muted: { color: C.muted, marginTop: 5 },
  status: { color: C.red, fontWeight: '900', fontSize: 11, marginTop: 5, textAlign: 'right' },
});
