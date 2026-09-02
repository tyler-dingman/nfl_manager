import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  API_BASE_URL,
  getMerch,
  getRewards,
  type MerchProduct,
  type RewardsDashboard,
} from '../lib/api';
import { C, Eyebrow, Heading } from '../components/screen';
export default function Merch() {
  const [products, setProducts] = useState<MerchProduct[]>([]),
    [categories, setCategories] = useState<string[]>([]),
    [category, setCategory] = useState('New & Trending'),
    [rewards, setRewards] = useState<RewardsDashboard | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    void Promise.all([getMerch(), getRewards().catch(() => null)])
      .then(([catalog, rewardData]) => {
        setProducts(catalog.products);
        setCategories(catalog.categories);
        setRewards(rewardData);
      })
      .finally(() => setLoading(false));
  }, []);
  const visible = useMemo(
    () =>
      category === 'New & Trending'
        ? products.filter((p) => Boolean(p.badge))
        : products.filter((p) => p.category === category),
    [category, products],
  );
  const availableReward = rewards?.rewards.find((reward) =>
    ['AVAILABLE', 'CLAIMED'].includes(reward.status),
  );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <Eyebrow>D&amp;D MERCH</Eyebrow>
      <Heading>Get your head in the game.</Heading>
      {rewards ? (
        <View style={s.yards}>
          <View>
            <Text style={s.yardLabel}>MOVE THE CHAINS</Text>
            <Text style={s.yardValue}>{rewards.progress.currentDriveYards} YDS</Text>
          </View>
          <Text style={s.reward}>
            {rewards.nextReward
              ? `${rewards.yardsToNextReward} to ${rewards.nextReward.title}`
              : 'Locker unlocked'}
          </Text>
        </View>
      ) : null}
      {availableReward ? (
        <View style={s.available}>
          <Text style={s.availableLabel}>AVAILABLE IN THE LOCKER</Text>
          <Text style={s.availableTitle}>{availableReward.title}</Text>
          {availableReward.couponCode ? (
            <Text style={s.coupon}>{availableReward.couponCode}</Text>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categories}
      >
        {categories.map((item) => (
          <Pressable
            key={item}
            style={[s.category, item === category && s.categoryActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[s.categoryText, item === category && s.categoryTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? (
        <ActivityIndicator color={C.red} style={s.loader} />
      ) : (
        <View style={s.grid}>
          {visible.map((product) => (
            <Pressable
              key={product.id}
              style={s.product}
              onPress={() =>
                void WebBrowser.openBrowserAsync(`${API_BASE_URL}/merch/${product.id}`)
              }
            >
              {product.imageUrl ? (
                <Image
                  source={{ uri: `${API_BASE_URL}${product.imageUrl}` }}
                  style={s.image}
                  resizeMode="contain"
                />
              ) : (
                <View style={s.placeholder}>
                  <Text style={s.placeholderText}>D&amp;D</Text>
                </View>
              )}
              <View style={s.productCopy}>
                {product.badge ? <Text style={s.badge}>{product.badge.toUpperCase()}</Text> : null}
                <Text style={s.name}>{product.name}</Text>
                <View style={s.priceRow}>
                  <Text style={s.price}>${product.price}</Text>
                  {product.compareAtPrice ? (
                    <Text style={s.compare}>${product.compareAtPrice}</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={s.note}>Products open the existing D&amp;D storefront and demo checkout.</Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 40 },
  yards: {
    backgroundColor: C.navy,
    borderRadius: 17,
    padding: 17,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yardLabel: { color: C.gold, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  yardValue: { color: C.white, fontSize: 23, fontWeight: '900', marginTop: 3 },
  reward: { color: '#C7D1D7', fontSize: 13, maxWidth: 165, textAlign: 'right' },
  available: { backgroundColor: '#FFF0DF', borderRadius: 14, padding: 14, marginTop: 10 },
  availableLabel: { color: C.red, fontSize: 12, fontWeight: '900', letterSpacing: 0.9 },
  availableTitle: { color: C.ink, fontWeight: '900', marginTop: 4 },
  coupon: { color: C.red, fontWeight: '900', marginTop: 6 },
  categories: { gap: 8, paddingVertical: 20 },
  category: {
    borderWidth: 1,
    borderColor: '#D9D2C7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.white,
  },
  categoryActive: { backgroundColor: C.red, borderColor: C.red },
  categoryText: { color: C.ink, fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: C.white },
  loader: { marginTop: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  product: {
    width: '48.5%',
    backgroundColor: C.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: { width: '100%', height: 165, backgroundColor: '#EEE8DF' },
  placeholder: {
    height: 165,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: C.gold, fontWeight: '900', fontSize: 24 },
  productCopy: { padding: 13 },
  badge: { color: C.red, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  name: { color: C.ink, fontWeight: '900', fontSize: 14, lineHeight: 18, marginTop: 5 },
  priceRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  price: { color: C.ink, fontWeight: '900' },
  compare: { color: C.muted, textDecorationLine: 'line-through' },
  note: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12 },
});
