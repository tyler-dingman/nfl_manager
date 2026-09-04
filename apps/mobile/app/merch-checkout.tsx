import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { placeCommerceOrder, quoteCommerceOrder } from '../lib/api';
import { useCommerceCart } from '../lib/commerce-cart';
import { C, Heading } from '../components/screen';
const initial = {
  email: '',
  phone: '',
  firstName: '',
  lastName: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  promoCode: '',
};
export default function Checkout() {
  const [form, setForm] = useState(initial),
    [stage, setStage] = useState<'entry' | 'standard' | 'review'>('entry'),
    [shippingMethod, setShipping] = useState('STANDARD'),
    [paymentMethod, setPayment] = useState('CARD'),
    [quote, setQuote] = useState<any>(null),
    [walletLoading, setWalletLoading] = useState(''),
    [error, setError] = useState(''),
    [placing, setPlacing] = useState(false);
  const { items, clear } = useCommerceCart();
  useEffect(() => {
    void quoteCommerceOrder({ items })
      .then(setQuote)
      .catch(() => undefined);
  }, [items]);
  const field = (key: keyof typeof initial, label: string) => (
    <TextInput
      value={form[key]}
      onChangeText={(value) => setForm((x) => ({ ...x, [key]: value }))}
      placeholder={label}
      style={s.input}
      autoCapitalize={key === 'email' ? 'none' : 'words'}
    />
  );
  const submit = async () => {
    setPlacing(true);
    setError('');
    try {
      const order = await placeCommerceOrder({ ...form, shippingMethod, paymentMethod, items });
      clear();
      router.replace({
        pathname: '/order/[orderId]',
        params: { orderId: order.id, confirmed: '1' },
      } as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to place order.');
    } finally {
      setPlacing(false);
    }
  };
  const applyPromo = async () => {
    setError('');
    try {
      setQuote(await quoteCommerceOrder({ items, promoCode: form.promoCode || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to apply promo code.');
    }
  };
  const express = async (provider: string) => {
    setWalletLoading(provider);
    setError('');
    try {
      setPayment(provider);
      setForm((value) => ({
        ...value,
        email: 'demo-shopper@downanddistance.test',
        phone: '555-0100',
        firstName: 'Demo',
        lastName: 'Shopper',
        address1: '100 Football Way',
        city: 'Kansas City',
        state: 'MO',
        postalCode: '64129',
      }));
      setQuote(
        await quoteCommerceOrder({
          items,
          promoCode: form.promoCode || undefined,
          shippingMethod: 'STANDARD',
        }),
      );
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Express checkout temporarily unavailable.');
    } finally {
      setWalletLoading('');
    }
  };
  if (stage === 'entry')
    return (
      <ScrollView style={s.page} contentContainerStyle={s.body}>
        <Heading>CHECKOUT</Heading>
        <Text style={s.subtle}>DEMO CHECKOUT · No real payment will be processed.</Text>
        <Label text="HAVE A PROMO CODE?" />
        <View style={s.row}>
          {field('promoCode', 'CODE')}
          <Pressable style={s.apply} onPress={() => void applyPromo()}>
            <Text style={s.applyText}>APPLY</Text>
          </Pressable>
        </View>
        <View style={s.summary}>
          <Label text="ORDER SUMMARY" />
          <Line label="Items" cents={quote?.subtotalCents} />
          {quote?.discountCents ? <Line label="Discount" cents={-quote.discountCents} /> : null}
          <Line label="Shipping" value="Calculated at checkout" />
          <Line label="Tax" value="Calculated at checkout" />
          <Line label="Estimated subtotal" cents={quote?.totalCents} strong />
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Label text="EXPRESS CHECKOUT" />
        {[
          ['PAYPAL', 'PAYPAL CHECKOUT'],
          ['APPLE_PAY', 'APPLE PAY'],
          ['GOOGLE_PAY', 'GOOGLE PAY'],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            disabled={!!walletLoading}
            onPress={() => void express(id)}
            accessibilityRole="button"
            accessibilityLabel={`Checkout with ${label.replace(' CHECKOUT', '').replaceAll('_', ' ')}`}
            style={[s.wallet, id === 'PAYPAL' ? s.paypal : id === 'APPLE_PAY' ? s.apple : s.google]}
          >
            {walletLoading === id ? (
              <Text style={[s.walletText, id === 'PAYPAL' && s.paypalText]}>OPENING {label}…</Text>
            ) : (
              <MobilePaymentBrand provider={id} />
            )}
          </Pressable>
        ))}
        <Text style={s.or}>— OR —</Text>
        <Pressable style={s.standard} onPress={() => setStage('standard')}>
          <Text style={s.buttonText}>CONTINUE TO CHECKOUT →</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={s.back}>Back to bag</Text>
        </Pressable>
      </ScrollView>
    );
  if (stage === 'review')
    return (
      <ScrollView style={s.page} contentContainerStyle={s.body}>
        <Heading>REVIEW YOUR ORDER</Heading>
        <Text style={s.subtle}>{paymentMethod.replace('_', ' ')} · DEMO</Text>
        <View style={s.summary}>
          <Label text="SHIP TO" />
          <Text style={s.address}>
            {form.firstName} {form.lastName}
            {'\n'}
            {form.address1}
            {'\n'}
            {form.city}, {form.state} {form.postalCode}
          </Text>
          <Line label="Standard shipping" cents={quote?.shippingCents} />
          <Line label="Estimated tax" cents={quote?.taxCents} />
          <Line label="Order total" cents={quote?.totalCents} strong />
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable disabled={placing} style={s.button} onPress={() => void submit()}>
          <Text style={s.buttonText}>{placing ? 'PLACING ORDER…' : 'PLACE DEMO ORDER'}</Text>
        </Pressable>
        <Pressable onPress={() => setStage('entry')}>
          <Text style={s.back}>Back to checkout options</Text>
        </Pressable>
      </ScrollView>
    );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.body}>
      <Heading>DEMO CHECKOUT</Heading>
      <Text style={s.demo}>NO REAL PAYMENT WILL BE PROCESSED</Text>
      <Label text="CONTACT" />
      {field('email', 'Email')}
      {field('phone', 'Phone (optional)')}
      <Label text="SHIPPING INFORMATION" />
      <View style={s.row}>
        {field('firstName', 'First name')}
        {field('lastName', 'Last name')}
      </View>
      {field('address1', 'Address')}
      {field('address2', 'Address line 2')}
      <View style={s.row}>
        {field('city', 'City')}
        {field('state', 'State')}
        {field('postalCode', 'ZIP')}
      </View>
      <Label text="SHIPPING METHOD" />
      <Options
        values={[
          ['STANDARD', 'Standard · $6.99'],
          ['EXPRESS', 'Express · $12.99'],
        ]}
        selected={shippingMethod}
        select={setShipping}
      />
      <Label text="PAYMENT" />
      <Options
        values={[['CARD', 'Card — demo payment']]}
        selected={paymentMethod}
        select={setPayment}
      />
      <Text style={s.note}>
        Demo controls only. No card number or payment credential is collected.
      </Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable
        disabled={placing || !items.length}
        style={[s.button, placing && { opacity: 0.5 }]}
        onPress={() => void submit()}
      >
        <Text style={s.buttonText}>{placing ? 'PLACING ORDER…' : 'PLACE DEMO ORDER'}</Text>
      </Pressable>
      <Pressable onPress={() => setStage('entry')}>
        <Text style={s.back}>Back to checkout options</Text>
      </Pressable>
    </ScrollView>
  );
}
function MobilePaymentBrand({ provider }: { provider: string }) {
  const [failed, setFailed] = useState(false);
  if (provider === 'APPLE_PAY')
    return (
      <View style={s.brandRow}>
        <Ionicons name="logo-apple" color="#FFF" size={25} />
        <Text style={s.brandText}>Pay</Text>
      </View>
    );
  const paypal = provider === 'PAYPAL';
  return (
    <View style={s.brandRow}>
      <Image
        onError={() => setFailed(true)}
        source={{
          uri: paypal
            ? 'https://www.paypalobjects.com/marketing/web/icons/monogram/pp64.png'
            : 'https://developers.google.com/static/pay/api/images/brand-guidelines/google-pay-mark.png',
        }}
        resizeMode="contain"
        style={paypal ? s.paypalMark : s.googleMark}
      />
      {paypal || failed ? (
        <Text style={s.brandText}>{paypal ? 'PayPal Checkout' : 'Google Pay'}</Text>
      ) : null}
    </View>
  );
}
function Line({
  label,
  cents,
  value,
  strong = false,
}: {
  label: string;
  cents?: number;
  value?: string;
  strong?: boolean;
}) {
  return (
    <View style={[s.line, strong && s.strongLine]}>
      <Text style={strong && s.strong}>{label}</Text>
      <Text style={[s.lineValue, strong && s.strong]}>
        {value ??
          (typeof cents === 'number'
            ? `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
            : '—')}
      </Text>
    </View>
  );
}
function Label({ text }: { text: string }) {
  return <Text style={s.label}>{text}</Text>;
}
function Options({
  values,
  selected,
  select,
}: {
  values: string[][];
  selected: string;
  select: (x: string) => void;
}) {
  return (
    <View style={s.options}>
      {values.map(([value, label]) => (
        <Pressable
          key={value}
          onPress={() => select(value)}
          style={[s.option, selected === value && s.active]}
        >
          <Text style={[s.optionText, selected === value && { color: C.white }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 20, paddingBottom: 50 },
  demo: {
    backgroundColor: '#FFF0DF',
    padding: 14,
    borderRadius: 12,
    color: C.ink,
    fontWeight: '900',
    marginTop: 16,
  },
  subtle: { color: C.muted, marginTop: 8 },
  summary: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginTop: 18 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  strongLine: { borderTopWidth: 1, borderTopColor: '#DDD6CD', paddingTop: 14, marginTop: 14 },
  strong: { fontWeight: '900', color: C.ink },
  lineValue: { color: C.ink, fontWeight: '700' },
  apply: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontWeight: '900', color: C.navy },
  wallet: {
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  paypal: { backgroundColor: '#00A8EA' },
  apple: { backgroundColor: '#000' },
  google: { backgroundColor: '#000' },
  walletText: { color: '#FFF', fontWeight: '900' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  brandText: { color: '#FFF', fontWeight: '900', fontSize: 17 },
  paypalMark: { width: 28, height: 28 },
  googleMark: { width: 72, height: 40 },
  paypalText: { color: '#FFF' },
  googleText: { color: '#202124' },
  or: { textAlign: 'center', color: C.muted, fontWeight: '900', marginVertical: 14 },
  standard: {
    backgroundColor: C.navy,
    borderRadius: 28,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { textAlign: 'center', color: C.ink, fontWeight: '800', padding: 16 },
  address: { color: C.ink, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '900', color: C.ink, marginTop: 24, marginBottom: 7 },
  input: {
    height: 50,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8D2C9',
    paddingHorizontal: 13,
    marginBottom: 8,
    flex: 1,
  },
  row: { flexDirection: 'row', gap: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: '#D8D2C9',
    borderRadius: 12,
    padding: 13,
    backgroundColor: C.white,
  },
  active: { backgroundColor: C.navy },
  optionText: { fontWeight: '800', color: C.ink },
  note: { color: C.muted, fontSize: 12, marginTop: 8 },
  error: { color: '#B42318', fontWeight: '700', marginTop: 14 },
  button: {
    backgroundColor: C.red,
    borderRadius: 28,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: { color: C.white, fontWeight: '900' },
});
