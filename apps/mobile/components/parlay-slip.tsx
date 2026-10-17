import { useSportsbookTransfers } from '../../../packages/parlay/use-sportsbook-transfers';
import { SportsbookTransfers } from './sportsbook-transfers';
import { labScoreColor } from '../../../packages/parlay/lab-score-config';
import { getReadableTextColor } from '../../../src/lib/color-utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Linking,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { authenticatedFetch } from '../lib/auth';
import { largeDeviceStorage as storage } from '../lib/large-device-storage';
import type { ParlayEvent, ParlayMarket } from '../lib/parlay';
import { displayOdds, slipOdds, slipText, slipPick } from '../../../packages/parlay/slip';
import {
  accountParlays,
  mergeSavedParlays,
  saveAccountParlay,
} from '../../../packages/parlay/account-saves';
import { snapshotSavedPlay, type SavedPlay } from '../../../src/components/parlay-lab/saved-plays';
export function ParlaySlip({
  legs,
  setLegs,
  events,
  onOpen,
  markets = legs,
  accent = '#da1238',
}: {
  legs: ParlayMarket[];
  markets?: ParlayMarket[];
  accent?: string;
  setLegs: (m: ParlayMarket[]) => void;
  events: ParlayEvent[];
  onOpen: (m: ParlayMarket) => void;
}) {
  const sportsbookTransfers = useSportsbookTransfers(legs, authenticatedFetch);
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState('Parlay'),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saved, setSaved] = useState<SavedPlay[]>([]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const image = useRef<Svg>(null);
  const key = `dd-native-parlay-slips-${user?.id ?? 'guest'}`;
  const total = slipOdds(legs);
  const text = slipText(legs);
  useEffect(() => {
    if (!open || tab !== 'Saved') return;
    let active = true;
    void Promise.all([storage.get(key), accountParlays(authenticatedFetch)])
      .then(([raw, remote]) => {
        if (active) setSaved(mergeSavedParlays(JSON.parse(raw ?? '[]'), remote));
      })
      .catch(() => setNotice('Unable to load saved parlays.'));
    return () => {
      active = false;
    };
  }, [open, tab, key]);
  const save = async () => {
    setBusy(true);
    try {
      const play = snapshotSavedPlay({
        selections: legs,
        event: events.find((e) => legs.every((m) => m.eventId === e.id)),
      });
      await saveAccountParlay(authenticatedFetch, play);
      const raw = JSON.parse((await storage.get(key)) ?? '[]');
      const next = mergeSavedParlays(Array.isArray(raw) ? raw : [], [play]);
      await storage.set(key, JSON.stringify(next.slice(0, 20)));
      setSaved(next);
      setNotice('Saved to your account and My Parlays.');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportImage = async () => {
    try {
      if (!image.current) throw Error('Image is not ready.');
      const data = await new Promise<string>((resolve) => image.current!.toDataURL(resolve));
      const uri = `${FileSystem.cacheDirectory}parlay-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, data, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save Parlay Image' });
      else setNotice('Image sharing is unavailable on this device.');
    } catch {
      setNotice('Unable to export image. Please try again.');
    }
  };
  const action = async (kind: string) => {
    try {
      if (kind === 'Save Image') return await exportImage();
      if (kind === 'Messages')
        await Linking.openURL(
          `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}`,
        );
      else await Share.share({ title: 'Down & Distance · My Parlay', message: text });
    } catch {
      setNotice('Unable to open sharing. Please try again.');
    }
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Expand My Parlay (${legs.length})`}
        onPress={() => setOpen(true)}
        style={s.bar}
      >
        <Text style={s.title}>My Parlay ({legs.length})</Text>
        <Text style={s.title}>{displayOdds(total)}</Text>
        <Text style={s.copy}>Expand ↑</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <Pressable
            accessibilityLabel="Close parlay"
            style={{ flex: 1 }}
            onPress={() => setOpen(false)}
          />
          <View style={[s.sheet, { paddingBottom: Math.max(12, insets.bottom) }]}>
            <View style={s.row}>
              <Text style={s.heading}>My Parlay ({legs.length})</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close parlay"
                style={s.touch}
                onPress={() => setOpen(false)}
              >
                <Feather name="x" size={22} color="white" />
              </Pressable>
            </View>
            <View style={s.row}>
              {['Parlay', 'Saved'].map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: t === tab }}
                  style={[s.tab, t === tab && { borderBottomColor: accent }]}
                  onPress={() => setTab(t)}
                >
                  <Text style={s.tabLabel}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 12 }}>
              {tab === 'Saved' ? (
                <>
                  {saved.length === 0 && (
                    <Text style={[s.copy, s.savedMessage]}>No saved parlays yet.</Text>
                  )}
                  {saved.map((p) => (
                    <View key={p.id} style={s.leg}>
                      <Text style={s.title}>
                        {p.selections.length} Leg Parlay · {displayOdds(p.savedCombinedOdds)}
                      </Text>
                      {p.selections.map((m, i) => (
                        <Text key={i} style={s.copy}>
                          {m.playerName} · {m.side} {m.line} {m.marketType.replaceAll('_', ' ')}
                        </Text>
                      ))}
                    </View>
                  ))}
                </>
              ) : !legs.length ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Feather name="plus" color="#a8c0cd" size={28} />
                  <Text style={s.heading}>Build Your Parlay</Text>
                  <Text style={s.copy}>
                    Select player props from Trending Props to start building your slip.
                  </Text>
                </View>
              ) : (
                legs.map((m) => {
                  const e = events.find((e) => e.id === m.eventId);
                  return (
                    <NewLeg key={`${m.id}:${m.sportsbook}`}>
                      {m.headshotUrl ? (
                        <Image
                          source={{ uri: m.headshotUrl }}
                          style={{ width: 36, height: 40, resizeMode: 'contain' }}
                        />
                      ) : (
                        <Feather name="user" size={30} color="#a8c0cd" />
                      )}
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => {
                          setOpen(false);
                          onOpen(m);
                        }}
                      >
                        <Text style={s.title}>{m.playerName ?? m.teamId}</Text>
                        <Text style={s.copy}>{slipPick(m)}</Text>
                        <Text style={s.copy}>
                          {m.teamId}
                          {e
                            ? ` vs ${e.homeTeamId === m.teamId ? e.awayTeamId : e.homeTeamId}`
                            : ''}
                        </Text>
                        <Text style={s.title}>
                          {displayOdds(m.odds)} · Lab Score{' '}
                          <Text style={{ color: labScoreColor(m.trend?.trendScore) }}>
                            {m.trend?.trendScore ?? '—'}
                          </Text>
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.playerName}`}
                        style={s.touch}
                        onPress={() => setLegs(legs.filter((n) => n.id !== m.id))}
                      >
                        <Feather name="x" color="white" size={18} />
                      </Pressable>
                    </NewLeg>
                  );
                })
              )}
            </ScrollView>
            {tab === 'Parlay' && legs.length > 0 && (
              <View style={s.actions}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{legs.length} Leg Parlay</Text>
                    <Text style={s.copy}>Estimated combined odds</Text>
                  </View>
                  <Text style={s.heading}>{displayOdds(total)}</Text>
                </View>
                <SportsbookTransfers
                  model={sportsbookTransfers}
                  accent={accent}
                  showDetails={detailsOpen}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: detailsOpen }}
                  aria-expanded={detailsOpen}
                  onPress={() => setDetailsOpen(!detailsOpen)}
                  style={[s.row, { paddingVertical: 12 }]}
                >
                  <Text style={s.copy}>Actions &amp; details</Text>
                  <Feather
                    name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="white"
                  />
                </Pressable>
                {detailsOpen && (
                  <View>
                    <View style={s.row}>
                      {(['Save Image', 'Messages', 'Share'] as const).map((label, i) => (
                        <Pressable
                          key={label}
                          accessibilityRole="button"
                          style={s.utility}
                          onPress={() => void action(label)}
                        >
                          <Feather
                            name={(['download', 'message-circle', 'share-2'] as const)[i]}
                            size={18}
                            color="white"
                          />
                          <Text style={s.buttonText}>{label.toUpperCase()}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      style={[s.save, { backgroundColor: accent }]}
                      onPress={() => void save()}
                    >
                      <Text style={[s.buttonText, { color: getReadableTextColor(accent) }]}>
                        {busy ? 'SAVING…' : 'SAVE'}
                      </Text>
                    </Pressable>
                    <Text style={s.note}>
                      Odds and availability can change. Always confirm in your sportsbook. Same-game
                      pricing may differ.
                    </Text>
                  </View>
                )}
              </View>
            )}
            {!!notice && (
              <Text accessibilityRole="alert" style={s.copy}>
                {notice}
              </Text>
            )}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              pointerEvents="none"
              style={{ position: 'absolute', left: -2000, top: 0 }}
            >
              <Svg ref={image} width={1080} height={320 + legs.length * 150}>
                <Rect width="100%" height="100%" fill="#00141e" />
                <SvgText x={48} y={80} fill="white" fontSize={42} fontWeight="bold">
                  DOWN &amp; DISTANCE
                </SvgText>
                <SvgText x={48} y={130} fill="white" fontSize={30}>
                  MY PARLAY · {legs.length} LEGS
                </SvgText>
                {legs.map((m, i) => (
                  <SvgText key={i} x={48} y={190 + i * 150} fill="white" fontSize={26}>
                    <SvgText x={48}>{m.playerName}</SvgText>
                    <SvgText x={48} dy={40}>
                      {slipPick(m)}
                    </SvgText>
                    <SvgText x={48} dy={40}>
                      {displayOdds(m.odds)} · Lab Score{' '}
                      <Text style={{ color: labScoreColor(m.trend?.trendScore) }}>
                        {m.trend?.trendScore ?? '—'}
                      </Text>
                    </SvgText>
                  </SvgText>
                ))}
                <SvgText x={48} y={legs.length * 150 + 210} fill="white" fontSize={28}>
                  Estimated combined odds: {displayOdds(total)}
                </SvgText>
                <SvgText x={48} y={legs.length * 150 + 265} fill="#b8cbd6" fontSize={22}>
                  Generated {new Date().toISOString().slice(0, 10)} · Odds may change.
                </SvgText>
              </Svg>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
function NewLeg({ children }: { children: ReactNode }) {
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setFresh(false), 1500);
    return () => clearTimeout(timer);
  }, []);
  return <View style={[s.leg, s.row, fresh && { backgroundColor: '#16404a' }]}>{children}</View>;
}
const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a2836',
    padding: 15,
    borderTopWidth: 1,
    borderColor: '#315162',
  },
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#031923',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heading: {
    fontFamily: 'BarlowCondensed',
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
  },
  title: {
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  copy: {
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
    color: '#a8c0cd',
    fontSize: 12,
    lineHeight: 19,
  },
  note: {
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
    color: '#a8c0cd',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
  },
  touch: { minHeight: 44, minWidth: 36, justifyContent: 'center', alignItems: 'center' },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontFamily: 'BarlowCondensed', color: 'white', fontSize: 14 },
  savedMessage: { fontFamily: 'BarlowCondensed' },
  leg: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#244552', gap: 8 },
  actions: { paddingVertical: 12, borderTopWidth: 1, borderColor: '#244552' },
  utility: {
    flex: 1,
    backgroundColor: '#0a2836',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  buttonText: {
    fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }),
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
  save: {
    padding: 14,
    backgroundColor: '#da1238',
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
});
