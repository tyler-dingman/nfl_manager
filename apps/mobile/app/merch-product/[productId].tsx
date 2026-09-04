import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL, getMerch, type MerchProduct } from '../../lib/api';
import { useCommerceCart } from '../../lib/commerce-cart';
import { C } from '../../components/screen';
export default function Product() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [product, setProduct] = useState<MerchProduct>(),
    [quantity, setQuantity] = useState(1);
  const { add } = useCommerceCart();
  useEffect(() => {
    void getMerch().then((x) => setProduct(x.products.find((p) => p.id === productId)));
  }, [productId]);
  if (!product)
    return (
      <View style={s.page}>
        <Text>Loading product…</Text>
      </View>
    );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      {product.imageUrl ? (
        <Image
          source={{ uri: `${API_BASE_URL}${product.imageUrl}` }}
          style={s.image}
          resizeMode="contain"
        />
      ) : null}
      <Text style={s.kind}>{product.type}</Text>
      <Text style={s.title}>{product.name}</Text>
      <Text style={s.price}>${product.price.toFixed(2)}</Text>
      <Text style={s.copy}>
        {product.type === 'Koozie'
          ? 'Keep it cold. Rep your city. All season long.'
          : 'Built for Sundays, Saturdays, and everything in between.'}
      </Text>
      <Text style={s.label}>QUANTITY</Text>
      <View style={s.quantity}>
        <Pressable onPress={() => setQuantity((x) => Math.max(1, x - 1))}>
          <Text style={s.q}>−</Text>
        </Pressable>
        <Text style={s.q}>{quantity}</Text>
        <Pressable onPress={() => setQuantity((x) => Math.min(20, x + 1))}>
          <Text style={s.q}>+</Text>
        </Pressable>
      </View>
      <Pressable
        style={s.button}
        onPress={() => {
          add(product.id, product.sizes[0] ?? 'One Size', quantity);
          router.push('/merch-cart' as never);
        }}
      >
        <Text style={s.buttonText}>ADD TO CART · ${(product.price * quantity).toFixed(2)}</Text>
      </Pressable>
      {['Product Details', 'Shipping Info', 'Returns', 'Care'].map((x) => (
        <View key={x} style={s.detail}>
          <Text style={s.detailText}>{x} +</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 50 },
  image: { width: '100%', height: 340, backgroundColor: C.white, borderRadius: 20 },
  kind: { color: C.red, fontWeight: '900', fontSize: 12, marginTop: 22 },
  title: { fontSize: 32, fontWeight: '900', color: C.ink, marginTop: 6 },
  price: { fontSize: 22, fontWeight: '900', marginTop: 12, color: C.ink },
  copy: { fontSize: 17, lineHeight: 25, color: C.muted, marginTop: 18 },
  label: { fontSize: 12, fontWeight: '900', marginTop: 24, color: C.ink },
  quantity: { flexDirection: 'row', gap: 26, alignItems: 'center', marginTop: 10 },
  q: { fontSize: 22, fontWeight: '900', padding: 8 },
  button: {
    backgroundColor: C.red,
    borderRadius: 28,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: { color: C.white, fontWeight: '900' },
  detail: { borderTopWidth: 1, borderTopColor: '#D8D2C9', paddingVertical: 18 },
  detailText: { fontWeight: '900', color: C.ink },
});
