import { useState } from 'react';
import { SvgXml } from 'react-native-svg';
import { fanduelLogoSvg } from '../../../packages/parlay/fanduel-logo';
import { sportsbookBrands } from '../../../packages/parlay/sportsbook-brand';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  useWindowDimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getReadableTextColor } from '../../../src/lib/color-utils';
import {
  sportsbooks,
  sportsbookConfig,
  sportsbookNotice,
} from '../../../packages/parlay/sportsbook-transfer';
import { displayOdds, slipPick } from '../../../packages/parlay/slip';
import type { SportsbookTransferModel } from '../../../packages/parlay/use-sportsbook-transfers';
export function SportsbookTransfers({
  model: m,
  accent = '#da1238',
  showDetails = false,
}: {
  model: SportsbookTransferModel;
  accent?: string;
  showDetails?: boolean;
}) {
  const [openError, setOpenError] = useState('');
  const { height } = useWindowDimensions();
  const openSportsbook = (url: string) => {
    setOpenError('');
    void Linking.openURL(url).catch(() =>
      setOpenError('Unable to open the sportsbook. Use the ready link to try again.'),
    );
  };
  if (!m.loading && !m.error && !m.unavailable && !m.proposals.length) return null;
  const button = (label: string, press: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={[s.button, { backgroundColor: accent, opacity: disabled ? 0.55 : 1 }]}
    >
      <Text style={[s.title, { color: getReadableTextColor(accent) }]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView
      nestedScrollEnabled
      style={{ maxHeight: height * 0.35, marginBottom: 12 }}
      contentContainerStyle={s.box}
    >
      <Text style={s.title}>OPEN IN SPORTSBOOK</Text>
      {m.unavailable && (
        <Text style={s.copy} accessibilityLiveRegion="polite">
          {m.unavailableReason}
        </Text>
      )}
      {m.loading && (
        <Text style={s.copy} accessibilityLiveRegion="polite">
          Checking stored sportsbook availability...
        </Text>
      )}
      {!!m.error && (
        <Text style={s.copy} accessibilityRole="alert">
          {m.error}
        </Text>
      )}
      {[...m.proposals]
        .sort((a, b) => sportsbooks.indexOf(a.sportsbook) - sportsbooks.indexOf(b.sportsbook))
        .map((p) => {
          const book = p.sportsbook,
            name = sportsbookConfig[book].name,
            state = m.states[book];
          const brand =
            book === 'fanduel' || book === 'draftkings' ? sportsbookBrands[book] : undefined;
          const ink = brand?.ink ?? getReadableTextColor(accent);
          const brandMark = brand && (
            <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {book === 'fanduel' ? (
                <SvgXml xml={fanduelLogoSvg} width={104} height={30} />
              ) : (
                <>
                  <Image
                    source={require('../../../public/assets/sportsbooks/draftkings_logo.png')}
                    style={{ width: 28, height: 32 }}
                    resizeMode="contain"
                    alt=""
                  />
                  <View>
                    <Text style={[s.wordmark, { color: brand.accent }]}>DraftKings</Text>
                    <Text style={s.brandSub}>SPORTSBOOK</Text>
                  </View>
                </>
              )}
            </View>
          );
          return (
            <View key={book} style={s.box}>
              {m.confirmation === book ? (
                <View style={s.box}>
                  <Text style={s.title}>{name} Line Adjustment</Text>
                  {p.matches
                    .filter((x) => x.adjusted)
                    .map(({ original: o, selection: l }) => (
                      <Text key={o.id} style={s.copy}>
                        {o.playerName}
                        {'\n'}Original: {slipPick(o)}
                        {'\n'}Proposed: {slipPick(l)} · {displayOdds(l.odds)}
                      </Text>
                    ))}
                  <Text style={s.copy}>
                    Our stored prices include a nearby line at {name}. We’ll ask the sportsbook to
                    match this alternative. This changes the odds and payout. Your original parlay
                    stays unchanged.
                  </Text>
                  {button('Continue with Adjustment', m.confirm, m.busy)}
                  {button('Cancel', m.cancelConfirmation)}
                </View>
              ) : state?.url ? (
                <>
                  <Text accessibilityLiveRegion="polite" style={s.copy}>
                    Your {name} Slip Is Ready.
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={
                      book === 'fanduel' ? `Open in ${name} ↗` : `Continue to ${name} ↗`
                    }
                    style={[
                      s.button,
                      brand && s.branded,
                      { backgroundColor: brand?.background ?? accent },
                    ]}
                    onPress={() => {
                      setOpenError('');
                      void Linking.openURL(state.url!).catch(() =>
                        setOpenError('Unable to open the sportsbook. Please try the link again.'),
                      );
                    }}
                  >
                    <>
                      {brandMark}
                      <Text style={[s.title, { color: ink, flexShrink: 1 }]}>
                        {book === 'fanduel' ? `Open in ${name} ↗` : `Continue to ${name} ↗`}
                        {p.estimatedOdds != null && (
                          <Text style={{ fontSize: 11 }}>
                            {'\n'}Est. {displayOdds(p.estimatedOdds)}
                          </Text>
                        )}
                      </Text>
                    </>
                  </Pressable>
                </>
              ) : (
                <>
                  {state?.busy && (book !== 'fanduel' || m.waitingBook === book) && (
                    <ActivityIndicator color={accent} />
                  )}{' '}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open in ${name} ↗`}
                    accessibilityState={{
                      disabled:
                        m.busy && !(book === 'fanduel' && state?.busy && m.waitingBook !== book),
                      busy: !!state?.busy,
                    }}
                    disabled={
                      m.busy && !(book === 'fanduel' && state?.busy && m.waitingBook !== book)
                    }
                    onPress={() => {
                      setOpenError('');
                      m.choose(book, openSportsbook);
                    }}
                    style={
                      brand
                        ? [s.button, s.branded, { backgroundColor: brand.background }]
                        : [s.row, { opacity: m.busy ? 0.55 : 1 }]
                    }
                  >
                    {brandMark}
                    <View style={{ flexShrink: 1 }}>
                      <Text style={[s.title, brand && { color: ink }]}>
                        {state?.busy && (book !== 'fanduel' || m.waitingBook === book)
                          ? `Preparing Your ${name} Slip...`
                          : `Open in ${name} ↗`}
                      </Text>
                      {!!p.adjustments && (
                        <Text style={s.copy}>
                          {p.adjustments} line adjustment{p.adjustments === 1 ? '' : 's'}
                        </Text>
                      )}
                    </View>
                    {(!state?.busy || (book === 'fanduel' && m.waitingBook !== book)) && (
                      <Text
                        accessibilityLabel={`${name} · Estimated odds ${p.estimatedOdds == null ? 'Check odds' : displayOdds(p.estimatedOdds)}`}
                        style={[s.copy, brand && { color: ink }]}
                      >
                        {p.estimatedOdds == null
                          ? 'Check odds'
                          : `Est. ${displayOdds(p.estimatedOdds)}`}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
              {state?.busy && (book !== 'fanduel' || m.waitingBook === book) && (
                <>
                  <Text accessibilityLiveRegion="polite" style={s.copy}>
                    Matching your selections. This usually takes 10–20 seconds.
                  </Text>
                  {button('Cancel wait', () => m.cancel(book))}
                </>
              )}
              {!!state?.error && (
                <Text accessibilityRole="alert" style={s.copy}>
                  {state.error}
                </Text>
              )}
            </View>
          );
        })}

      {!!openError && (
        <Text accessibilityRole="alert" style={s.copy}>
          {openError}
        </Text>
      )}
      {showDetails && (
        <>
          <Text style={s.copy}>
            Stored prices are estimates. Direction and availability require review at the
            sportsbook.
          </Text>
          <Text style={s.copy}>{sportsbookNotice}</Text>
        </>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  secondary: {
    borderWidth: 1,
    borderColor: '#315162',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  branded: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    minHeight: 66,
  },
  wordmark: { fontFamily: 'BarlowCondensed', fontWeight: '800', fontSize: 22 },
  brandSub: { color: 'white', fontSize: 8, letterSpacing: 1.5 },
  box: { gap: 8, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#193b48',
    backgroundColor: '#0b2835',
  },
  button: { borderRadius: 8, padding: 12, width: '100%' },
  title: { fontFamily: 'BarlowCondensed', color: 'white', fontSize: 14 },
  copy: {
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
    color: '#a9bec9',
    fontSize: 12,
    lineHeight: 18,
  },
});
