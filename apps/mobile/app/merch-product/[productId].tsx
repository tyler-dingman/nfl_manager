import { PageState } from '../../components/page-heading';
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
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { add } = useCommerceCart();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setProduct(undefined);
    setQuantity(1);
    void getMerch()
      .then((x) => {
        if (!active) return;
        const found = x.products.find((p) => p.id === productId);
        setProduct(found);
        setSize(found?.sizes[0] ?? 'One Size');
      })
      .catch(() => {
        if (active) setError('Unable to load this product.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  if (!product)
    return (
      <View style={s.page}>
        <PageState
          title={loading ? 'Loading product…' : 'Product unavailable'}
          message={error || undefined}
        />
      </View>
    );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <Text style={s.shipping}>FREE SHIPPING ON ORDERS $75+ · SHOP PREVIEW</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/merch')}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={s.detailText}>← Back to shop</Text>
      </Pressable>
      <View style={s.image}>
        {product.imageUrl ? (
          <Image
            source={{
              uri: product.imageUrl.startsWith('http')
                ? product.imageUrl
                : `${API_BASE_URL}${product.imageUrl}`,
            }}
            style={s.image}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ color: C.muted, textAlign: 'center', marginTop: 100, fontWeight: '800' }}>
            Down & Distance
          </Text>
        )}
        {!!product.badge && (
          <Text
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              backgroundColor: '#FF3D38',
              color: 'white',
              padding: 10,
              borderRadius: 20,
              fontWeight: '800',
            }}
          >
            {product.badge}
          </Text>
        )}
      </View>
      <Text style={s.kind}>{product.type}</Text>
      <Text style={s.title}>{product.name}</Text>
      <Text style={s.price}>${product.price.toFixed(2)}</Text>
      <Text style={s.copy}>
        {product.type === 'Koozie'
          ? 'Keep it cold. Rep your city. All season long.'
          : 'Built for Sundays, Saturdays, and everything in between.'}
      </Text>
      {!!product.cityName && <Text style={s.label}>CITY COLORWAY · {product.cityName}</Text>}
      <Text style={s.label}>SELECT SIZE</Text>
      <View style={s.sizes}>
        {product.sizes.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: size === value }}
            onPress={() => setSize(value)}
            style={[s.size, size === value && { backgroundColor: C.navy }]}
          >
            <Text style={{ fontWeight: '800', color: size === value ? 'white' : C.ink }}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
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
          add(product.id, size, quantity);
          router.push('/merch-cart' as never);
        }}
      >
        <Text style={s.buttonText}>ADD TO CART · ${(product.price * quantity).toFixed(2)}</Text>
      </Pressable>
      <Text style={[s.copy, { textAlign: 'center', fontSize: 12 }]}>
        ✓ Demo cart — no payment collected
      </Text>
      {['Ships in 2–3 days', 'Easy returns', 'Secure demo'].map((x) => (
        <View key={x} style={s.detail}>
          <Text style={s.detailText}>✓ {x}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  shipping: {
    backgroundColor: '#FF3D38',
    color: 'white',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
    padding: 10,
  },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  size: {
    minWidth: '30%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00172B26',
    borderRadius: 12,
    backgroundColor: 'white',
  },
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 50 },
  image: { width: '100%', aspectRatio: 1, backgroundColor: C.white, borderRadius: 32 },
  kind: { color: C.red, fontWeight: '900', fontSize: 12, marginTop: 22 },
  title: { fontSize: 32, fontWeight: '900', color: C.ink, marginTop: 6 },
  price: { fontSize: 22, fontWeight: '900', marginTop: 12, color: C.ink },
  copy: { fontSize: 17, lineHeight: 25, color: C.muted, marginTop: 18 },
  label: { fontSize: 12, fontWeight: '900', marginTop: 24, color: C.ink },
  quantity: { flexDirection: 'row', gap: 26, alignItems: 'center', marginTop: 10 },
  q: { fontSize: 22, fontWeight: '900', padding: 8 },
  button: {
    backgroundColor: '#FF3D38',
    borderRadius: 32,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: { color: C.white, fontWeight: '900' },
  detail: { borderTopWidth: 1, borderTopColor: '#D8D2C9', paddingVertical: 18 },
  detailText: { fontWeight: '900', color: C.ink },
});
