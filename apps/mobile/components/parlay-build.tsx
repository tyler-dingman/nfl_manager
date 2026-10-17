import { accountParlays, mergeSavedParlays } from '../../../packages/parlay/account-saves';
import { ParlayGenerator } from './parlay-generator';
import { applySavedPlayResults, type GradeResult } from '../../../packages/parlay/saved-results';
import { authenticatedFetch } from '../lib/auth';
import { SectionMenu } from './section-menu';
import { useAuth } from '../lib/auth-context';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ParlayEvent, ParlayMarket } from '../lib/parlay';
import { largeDeviceStorage as deviceStorage } from '../lib/large-device-storage';
import { demoSession } from '../lib/demo-session';
import { type SavedPlay } from '../../../src/components/parlay-lab/saved-plays';

export function ParlayBuild({
  section,
  teamId,
  slip,
  setSlip,
  onOpen,
  events,
}: {
  events: ParlayEvent[];
  section: string;
  teamId: string;
  slip: ParlayMarket[];
  setSlip: (value: ParlayMarket[]) => void;
  onOpen: (value: ParlayMarket) => void;
}) {
  const { user } = useAuth();
  const KEY = `dd-native-parlay-slips-${user?.id ?? 'guest'}`;
  const [saved, setSaved] = useState<SavedPlay[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setSaved([]);
    setNotice('');
    if (demoSession.isActive()) {
      setReady(true);
      return;
    }
    void deviceStorage
      .get(KEY)
      .then(async (raw) => {
        const value = JSON.parse(raw ?? '[]');
        if (!Array.isArray(value)) throw new Error();
        if (active) {
          setSaved(mergeSavedParlays(value, await accountParlays(authenticatedFetch)));
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setNotice('Unable to load saved parlays. Reopen Parlay Lab to retry.');
      });
    return () => {
      active = false;
    };
  }, [KEY]);
  async function refreshResults() {
    if (busy || !saved.length) return;
    setBusy(true);
    try {
      const response = await authenticatedFetch('/api/parlay-lab/my-plays/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plays: saved }),
      });
      if (!response.ok) throw new Error('Results are temporarily unavailable.');
      const body = (await response.json()) as { results: GradeResult[] };
      const next = applySavedPlayResults(saved, body.results ?? []);
      if (!demoSession.isActive()) await deviceStorage.set(KEY, JSON.stringify(next));
      setSaved(next);
      setNotice('Results are up to date.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to refresh results.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      {section === 'generator' && (
        <ParlayGenerator teamId={teamId} slip={slip} setSlip={setSlip} onOpen={onOpen} />
      )}
      {section === 'my-plays' ? (
        <>
          <Text style={s.heading}>MY PARLAYS</Text>
          <Text style={s.copy}>Track your saved parlays.</Text>
          {!saved.length && (
            <Text style={s.copy}>
              {ready
                ? 'No saved parlays yet. Add props to your build to get started.'
                : 'Loading saved parlays…'}
            </Text>
          )}
          <SectionMenu
            title={`Status: ${filter}`}
            items={['ALL', 'UPCOMING', 'LIVE', 'HIT', 'MISSED', 'VOID'].map((value) => ({
              label: value,
              selected: filter === value,
              onPress: () => setFilter(value),
            }))}
          />
          <Pressable
            disabled={busy || !saved.length}
            style={s.touch}
            onPress={() => void refreshResults()}
          >
            <Text style={s.title}>{busy ? 'REFRESHING…' : 'REFRESH RESULTS'}</Text>
          </Pressable>
          {saved
            .filter((play) => filter === 'ALL' || play.status === filter)
            .map((play) => (
              <View style={s.card} key={play.id}>
                <Text style={s.title}>
                  {play.selections.length} LEGS · {play.status}
                </Text>
                <Text style={s.copy}>{new Date(play.createdAt ?? '').toLocaleDateString()}</Text>
                {play.selections.map((leg, i) => (
                  <Text key={`${leg.id}-${i}`} style={s.copy}>
                    {leg.playerName ?? leg.teamId} · {leg.marketType.replaceAll('_', ' ')} ·{' '}
                    {leg.side} {leg.line} · {leg.gradingStatus ?? 'UPCOMING'}{' '}
                    {leg.actualResult != null ? `· Actual ${leg.actualResult}` : ''}
                  </Text>
                ))}
                <Text style={s.title}>Combined odds: {play.savedCombinedOdds ?? '—'}</Text>
              </View>
            ))}
        </>
      ) : null}
      {!!notice && (
        <Text accessibilityRole="alert" style={s.copy}>
          {notice}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: '#061D2B',
    borderWidth: 1,
    borderColor: '#183743',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  heading: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 28, marginBottom: 12 },
  title: { color: 'white', fontWeight: '800', fontSize: 15, marginTop: 8 },
  copy: { color: '#A8BAC4', fontSize: 13, lineHeight: 21, marginVertical: 6 },
  input: {
    color: 'white',
    padding: 14,
    borderWidth: 1,
    borderColor: '#34505F',
    borderRadius: 8,
    minHeight: 80,
  },
  button: {
    borderRadius: 8,
    backgroundColor: '#FFB81C',
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonText: { color: '#001222', fontWeight: '900' },
  touch: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#183743',
    paddingVertical: 8,
  },
});
