import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCommerceOrder } from '../../lib/api';
import { C, Heading } from '../../components/screen';
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
export default function Order() {
  const { orderId, confirmed } = useLocalSearchParams<{ orderId: string; confirmed?: string }>();
  const [order, setOrder] = useState<any>();
  useEffect(() => {
    if (orderId) void getCommerceOrder(orderId).then(setOrder);
  }, [orderId]);
  if (!order)
    return (
      <View style={s.page}>
        <Text>Loading order…</Text>
      </View>
    );
  const steps = ['NEW', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'],
    current = steps.indexOf(order.fulfillment_status);
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      {confirmed ? (
        <>
          <Text style={s.thanks}>THANKS FOR YOUR ORDER</Text>
          <Text style={s.muted}>We’ve received your order.</Text>
        </>
      ) : null}
      <Heading>#{order.order_number}</Heading>
      <Text style={s.status}>{order.fulfillment_status}</Text>
      <View style={s.card}>
        <Text style={s.label}>ORDER STATUS</Text>
        <View style={s.steps}>
          {steps.map((x, i) => (
            <View key={x} style={s.step}>
              <View style={[s.line, i <= current && s.lineActive]} />
              <Text style={s.stepText}>{x === 'NEW' ? 'RECEIVED' : x}</Text>
            </View>
          ))}
        </View>
        {order.tracking_number ? (
          <Text style={s.tracking}>
            {order.carrier} · {order.tracking_number}
          </Text>
        ) : null}
      </View>
      <View style={s.card}>
        <Text style={s.label}>ITEMS</Text>
        {order.items.map((x: any) => (
          <View key={x.id} style={s.item}>
            <View>
              <Text style={s.name}>{x.productName}</Text>
              <Text style={s.muted}>
                {x.variantLabel} · Qty {x.quantity}
              </Text>
            </View>
            <Text style={s.name}>{money(x.lineTotalCents)}</Text>
          </View>
        ))}
        <View style={s.total}>
          <Text style={s.name}>TOTAL</Text>
          <Text style={s.name}>{money(order.total_cents)}</Text>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.label}>SHIPPING ADDRESS</Text>
        <Text style={s.address}>
          {order.shipping_address.firstName} {order.shipping_address.lastName}
          {'\n'}
          {order.shipping_address.address1}
          {'\n'}
          {order.shipping_address.city}, {order.shipping_address.state}{' '}
          {order.shipping_address.postalCode}
        </Text>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 50 },
  thanks: { color: C.red, fontWeight: '900', fontSize: 14, marginBottom: 7 },
  muted: { color: C.muted, marginTop: 4 },
  status: {
    alignSelf: 'flex-start',
    backgroundColor: C.navy,
    color: C.white,
    fontWeight: '900',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 15,
    marginTop: 14,
  },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 17, marginTop: 15 },
  label: { fontWeight: '900', fontSize: 12, color: C.ink },
  steps: { flexDirection: 'row', marginTop: 16 },
  step: { flex: 1 },
  line: { height: 6, backgroundColor: '#D8DDE0', marginRight: 3, borderRadius: 3 },
  lineActive: { backgroundColor: C.red },
  stepText: { fontSize: 8, fontWeight: '800', marginTop: 6, color: C.ink },
  tracking: { backgroundColor: '#F1F3F5', padding: 12, borderRadius: 10, marginTop: 16 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7E8',
    paddingTop: 13,
    marginTop: 13,
  },
  name: { fontWeight: '900', color: C.ink },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7E8',
    paddingTop: 16,
    marginTop: 16,
  },
  address: { color: C.ink, lineHeight: 22, marginTop: 10 },
});
