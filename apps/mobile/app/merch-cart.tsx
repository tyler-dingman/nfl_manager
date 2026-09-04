import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL, getMerch, type MerchProduct } from '../lib/api';
import { useCommerceCart } from '../lib/commerce-cart';
import { C, Heading } from '../components/screen';
export default function Cart() {
  const { items, update } = useCommerceCart();
  const [products, setProducts] = useState<MerchProduct[]>([]);
  useEffect(() => {
    void getMerch().then((x) => setProducts(x.products));
  }, []);
  const subtotal = items.reduce(
    (n, x) => n + (products.find((p) => p.id === x.productId)?.price ?? 0) * x.quantity,
    0,
  );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <Heading>YOUR CART</Heading>
      {items.map((item) => {
        const p = products.find((x) => x.id === item.productId);
        if (!p) return null;
        return (
          <View key={`${item.productId}:${item.size}`} style={s.item}>
            {p.imageUrl ? (
              <Image source={{ uri: `${API_BASE_URL}${p.imageUrl}` }} style={s.image} />
            ) : null}
            <View style={s.copy}>
              <Text style={s.name}>{p.name}</Text>
              <Text>{item.size}</Text>
              <Text style={s.price}>${(p.price * item.quantity).toFixed(2)}</Text>
              <View style={s.qty}>
                <Pressable onPress={() => update(item.productId, item.size, item.quantity - 1)}>
                  <Text style={s.q}>−</Text>
                </Pressable>
                <Text style={s.q}>{item.quantity}</Text>
                <Pressable onPress={() => update(item.productId, item.size, item.quantity + 1)}>
                  <Text style={s.q}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
      <View style={s.total}>
        <Text style={s.name}>Item Total</Text>
        <Text style={s.name}>${subtotal.toFixed(2)}</Text>
      </View>
      {items.length ? (
        <Pressable style={s.button} onPress={() => router.push('/merch-checkout' as never)}>
          <Text style={s.buttonText}>CHECKOUT</Text>
        </Pressable>
      ) : (
        <Text style={s.empty}>Your cart is empty.</Text>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 50 },
  item: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  image: { width: 90, height: 100, resizeMode: 'contain' },
  copy: { flex: 1, padding: 8 },
  name: { fontWeight: '900', color: C.ink },
  price: { fontWeight: '900', marginTop: 8 },
  qty: { flexDirection: 'row', gap: 20, alignItems: 'center', marginTop: 8 },
  q: { fontWeight: '900', fontSize: 18, padding: 4 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#D8D2C9',
    paddingTop: 20,
    marginTop: 20,
  },
  button: {
    backgroundColor: C.navy,
    borderRadius: 28,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  buttonText: { color: C.white, fontWeight: '900' },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});
