import { DeviceEventEmitter } from 'react-native';
import type { FrontOfficeEvent } from '../../../src/types/front-office';
import {
  isTradeDeadlinePassed,
  TRADE_DEADLINE_MESSAGE,
} from '../../../src/lib/front-office-trade-window';
import { heroStoryKey } from '../../../packages/front-office/hero-story';
import { FranchiseHeroStory } from './franchise-hero-story';
import { heroOwnershipSnapshot } from '../../../src/lib/hero-ownership';
import type { OwnershipState } from '../../../src/features/ownership/model';
import { largeDeviceStorage } from '../lib/large-device-storage';
import { restartFranchiseAtWeekOne } from '../../../src/lib/front-office-restart';
import { NativeFrontOfficeStart } from './front-office-start';
import { FranchiseNews } from './franchise-news';
import { FranchiseSettings } from './franchise-settings';
import { FranchiseTrades } from './franchise-trades';
import { FranchiseOwnership } from './franchise-ownership';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { authenticatedFetch } from '../lib/auth';
import { deviceStorage } from '../lib/device-storage';
import { useAuth } from '../lib/auth-context';
import { useTeamBranding } from '../lib/team-branding';
import { FranchiseRoster } from './franchise-roster';
import {
  getFranchisePhaseActions,
  phaseDisplayName,
  type FrontOfficePhaseAction,
} from '../../../src/lib/front-office-phase';
import { SectionMenu } from './section-menu';
import { TEAM_LIST } from '../../../src/data/teams';
import type { FranchiseSimulationState, FrontOfficePath } from '../../../src/types/front-office';
async function request<T>(path: string, body?: object, method = 'POST'): Promise<T> {
  const response = await authenticatedFetch(
    path,
    body
      ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok || result.ok === false)
    throw new Error(result.error ?? 'Unable to load your franchise.');
  return result;
}
export function FranchiseExperience({
  onActiveChange,
  onRealRoster,
  onRealTransactions,
}: {
  onActiveChange: (active: boolean) => void;
  onRealRoster: () => void;
  onRealTransactions: () => void;
}) {
  const { teamId, theme } = useTeamBranding();
  const { user } = useAuth();
  const team = TEAM_LIST.find((t) => t.abbr === teamId);
  const [saveId, setSaveId] = useState<string | null>(null);
  const [state, setState] = useState<FranchiseSimulationState | null>(null);
  useEffect(() => {
    onActiveChange(Boolean(state));
    return () => onActiveChange(false);
  }, [Boolean(state), onActiveChange]);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState('Overview');
  const [unreadNews, setUnreadNews] = useState(0);
  const [newsRevision, setNewsRevision] = useState(0);
  useEffect(() => {
    DeviceEventEmitter.emit('front-office-news-active', {saveId});
    const listener = DeviceEventEmitter.addListener('front-office-news-updated', payload => {
      if(payload.saveId === saveId) setNewsRevision(n=>n+1);
    });
    return () => { listener.remove(); DeviceEventEmitter.emit('front-office-news-active', {saveId:null}); };
  }, [saveId]);
  useEffect(() => {
    let active = true;
    setUnreadNews(0);
    if (saveId)
      void request<{ unreadCount: number }>(
        `/api/front-office/events?saveId=${encodeURIComponent(saveId)}&notifications=1`,
      )
        .then((result) => {
          if (active) setUnreadNews(result.unreadCount);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [saveId, state, section, newsRevision]);

  const [heroPlayerId, setHeroPlayerId] = useState<string>();
  const [heroFacility, setHeroFacility] = useState<string>();
  const key = `dd-franchise-${user?.id ?? 'guest'}-${teamId}`;
  useEffect(() => {
    let active = true;
    setRestoring(true);
    setState(null);
    setSaveId(null);
    void deviceStorage
      .get(key)
      .then(async (id) => {
        if (!id) return;
        const restored = await request<{ saveId: string }>('/api/saves/create', {
          teamAbbr: teamId,
        });
        const result = await request<{
          state: { simulation: FranchiseSimulationState | null } | null;
        }>(`/api/front-office/state?saveId=${encodeURIComponent(restored.saveId)}`);
        id = restored.saveId;
        if (active) {
          setSaveId(id);
          setState(result.state?.simulation ?? null);
        }
      })
      .catch(() => {
        if (active) setError('Unable to restore your franchise. Try again.');
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [key]);
  async function start(path: FrontOfficePath) {
    if (busy || restoring) return;
    setBusy(true);
    setError('');
    try {
      const save = await request<{ saveId: string; year: number }>('/api/saves/create', {
        teamAbbr: teamId,
      });
      const existing = await request<{
        state: { simulation: FranchiseSimulationState | null } | null;
      }>(`/api/front-office/state?saveId=${encodeURIComponent(save.saveId)}`);
      if (existing.state?.simulation) {
        setSaveId(save.saveId);
        setState(existing.state.simulation);
        setSection(path === 'full' ? 'Overview' : path === 'draft' ? 'Draft' : 'Free Agency');
        await deviceStorage.set(key, save.saveId);
        return;
      }
      const phase = path === 'full' ? 'week-1' : path === 'draft' ? 'draft' : 'free_agency';
      await request(
        '/api/front-office/state',
        {
          saveId: save.saveId,
          teamAbbr: teamId,
          season: save.year,
          selectedPath: path,
          simulationPhase: phase,
        },
        'PUT',
      );
      const result = await request<{ state: FranchiseSimulationState }>(
        '/api/front-office/simulate',
        { saveId: save.saveId, action: 'initialize', target: phase },
      );
      await deviceStorage.set(key, save.saveId);
      setSaveId(save.saveId);
      setState(result.state);
      setSection(path === 'full' ? 'Overview' : path === 'draft' ? 'Draft' : 'Free Agency');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start your franchise.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!saveId || section !== 'Overview') return;
    let active = true;
    void request<{ state: FranchiseSimulationState }>(
      `/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`,
    )
      .then((result) => {
        if (active) setState(result.state);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [saveId, section]);
  async function resetToWeekOne() {
    if (busy || !state) return;
    setBusy(true);
    setError('');
    try {
      const fresh = await restartFranchiseAtWeekOne(authenticatedFetch, teamId, state.season);
      await deviceStorage.set(key, fresh.header.saveId);
      setSaveId(fresh.header.saveId);
      setState(fresh.state);
      setSection('Overview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to reset to Week 1.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'front-office-news-open',
      (payload: { saveId: string }) => {
        if (payload.saveId === saveId) setSection('Notifications');
      },
    );
    return () => sub.remove();
  }, [saveId]);
  async function advance(action: FrontOfficePhaseAction) {
    if (!saveId || busy || !state) return;
    if (action.href) {
      setSection('Draft');
      return;
    }
    const execute = async () => {
      setBusy(true);
      setError('');
      try {
        const result = await request<{
          state: FranchiseSimulationState;
          events?: FrontOfficeEvent[];
        }>('/api/front-office/simulate', {
          saveId,
          action: 'advance',
          target: action.target,
          ownership: heroOwnershipSnapshot(
            JSON.parse(
              (await largeDeviceStorage.get(`dd-ownership-${saveId}-${teamId}`)) ?? 'null',
            ) as OwnershipState | undefined,
            state.season,
          ),
        });
        setState(result.state);
        DeviceEventEmitter.emit('front-office-news-updated', {
          saveId,
          teamAbbr: teamId,
          events: result.events ?? [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to advance season.');
      } finally {
        setBusy(false);
      }
    };
    if (action.requiresConfirmation)
      Alert.alert(action.label, action.confirmation, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void execute() },
      ]);
    else await execute();
  }
  const actions = state ? getFranchisePhaseActions(state, teamId) : null;
  const games = state?.games.filter((g) => g.homeTeam === teamId || g.awayTeam === teamId) ?? [];
  const record = state?.teams[teamId]?.record;
  if (restoring)
    return (
      <ActivityIndicator
        style={{ padding: 24 }}
        color="white"
        accessibilityLabel="Restoring franchise"
      />
    );
  return (
    <View>
      {state && (
        <>
          <Text style={s.eyebrow}>FRONT OFFICE · {team?.name ?? teamId}</Text>
          <Text
            style={[s.title, state && section !== 'Overview' && { fontSize: 22, lineHeight: 26 }]}
          >
            {state
              ? `${team?.name ?? teamId} Front Office`
              : `Take control of the ${team?.name.replace(`${team.city} `, '') ?? teamId}.`}
          </Text>
          <Text style={s.copy}>
            {state
              ? `${state.season} · ${phaseDisplayName(state.phase)}`
              : 'The decisions are yours. Build the roster, manage the cap, navigate the draft, and shape the future of the franchise.'}
          </Text>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {busy && <ActivityIndicator color="white" />}
      {!state ? (
        <NativeFrontOfficeStart teamId={teamId} busy={busy} onStart={(path) => void start(path)} />
      ) : (
        <>
          <SectionMenu
            navigation={{ inset: 16 }}
            title="Franchise sections"
            items={[
              ...[
                'Overview',
                'Roster',
                'Free Agency',
                'Draft',
                'Trades',
                'Development',
                'Ownership',
                'Schedule',
                'Standings',
                'Transactions',
                'Settings',
                'League News',
                'Messages',
              ].map((label) => ({
                label,
                selected: section === label,
                onPress: () => {
                  setHeroPlayerId(undefined);
                  setSection(label);
                },
              })),
              { label: 'Real-world roster & contracts', onPress: onRealRoster },
              { label: 'Real-world transactions', onPress: onRealTransactions },
            ]}
          />
          {actions && section === 'Overview' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                disabled={busy}
                style={[s.button, { backgroundColor: theme.primaryFill }]}
                onPress={() => void advance(actions.primary)}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>
                  {busy ? 'SIMULATING…' : actions.primary.label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Starts a fresh Week 1 and preserves your previous save"
                disabled={busy}
                onPress={() => void resetToWeekOne()}
                style={[
                  s.button,
                  { borderWidth: 1, borderColor: '#8ba3ae', opacity: busy ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Reset to Week 1</Text>
              </Pressable>
            </View>
          )}
          {saveId &&
            (section === 'League News' ||
              section === 'Messages' ||
              section === 'Notifications') && (
              <FranchiseNews
                key={section}
                saveId={saveId}
                messages={section === 'Messages'}
                notificationsOnly={section === 'Notifications'}
              />
            )}
          {saveId &&
            (section === 'Roster' ||
              section === 'Free Agency' ||
              section === 'Draft' ||
              section === 'Development') && (
              <FranchiseRoster
                key={`${saveId}-${section}-${state.phase}`}
                simulation={state}
                initialPlayerId={heroPlayerId}
                saveId={saveId}
                section={section}
                phase={state.phase}
                completedDraft={state.completedDraft}
                onDraftComplete={async () => {
                  const result = await request<{ state: FranchiseSimulationState }>(
                    `/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`,
                  );
                  setState(result.state);
                }}
              />
            )}
          {section === 'Settings' && saveId && (
            <FranchiseSettings saveId={saveId} simulation={state} />
          )}
          {section === 'Trades' && saveId && (
            <FranchiseTrades
              phase={state.phase}
              saveId={saveId}
              onChanged={async () => {
                const result = await request<{ state: FranchiseSimulationState }>(
                  `/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`,
                );
                setState(result.state);
              }}
            />
          )}
          {section === 'Ownership' && saveId && (
            <FranchiseOwnership saveId={saveId} simulation={state} initialFacility={heroFacility} />
          )}
          {section === 'Overview' && state.heroStories?.[heroStoryKey(state)] && (
            <FranchiseHeroStory
              key={`${saveId}:${state.phase}`}
              story={state.heroStories[heroStoryKey(state)]}
              onAcknowledge={(id) => {
                void request<{ state: FranchiseSimulationState }>('/api/front-office/simulate', {
                  saveId,
                  action: 'acknowledge-hero',
                  heroActionId: id,
                })
                  .then((result) => setState(result.state))
                  .catch(() => {});
              }}
              onSection={(next, facility, playerId) => {
                setHeroPlayerId(playerId);
                setHeroFacility(facility);
                setSection(next);
              }}
            />
          )}
          {section === 'Overview' && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Notifications, ${unreadNews} unread`}
                onPress={() => setSection('Notifications')}
                style={[
                  s.card,
                  { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8 },
                ]}
              >
                <Feather name="bell" color="white" size={24} />
                {unreadNews > 0 && (
                  <Text style={{ color: 'white', fontWeight: '800' }}>
                    {unreadNews > 99 ? '99+' : unreadNews}
                  </Text>
                )}
              </Pressable>
              {isTradeDeadlinePassed(state.phase, state.currentWeek) && (
                <View style={s.card}>
                  <Text style={s.heading}>Trade Market</Text>
                  <Text style={s.copy}>{TRADE_DEADLINE_MESSAGE}</Text>
                </View>
              )}
              <View style={s.card}>
                <Text style={s.heading}>YOUR SEASON</Text>
                <Text style={s.title}>
                  {record
                    ? `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ''}`
                    : '—'}
                </Text>
                <Text style={s.copy}>{state.teams[teamId]?.overall ?? '—'} TEAM OVERALL</Text>
              </View>
              <Pressable onPress={() => setSection('Roster')} style={s.card}>
                <Feather name="users" color="white" size={24} />
                <Text style={s.heading}>ROSTER & CONTRACTS</Text>
                <Text style={s.copy}>Review your players and cap situation →</Text>
              </Pressable>
            </>
          )}
          {(section === 'Schedule' || section === 'Overview') &&
            games.map((game) => (
              <View key={game.id} style={s.card}>
                <Text style={s.eyebrow}>
                  WEEK {game.week} · {game.seasonType}
                </Text>
                <Text style={s.heading}>
                  {game.awayTeam} {game.awayScore ?? ''} @ {game.homeTeam} {game.homeScore ?? ''}
                </Text>
                <Text style={s.copy}>
                  {game.played
                    ? 'FINAL'
                    : game.startsAt
                      ? new Date(game.startsAt).toLocaleString()
                      : 'UPCOMING'}
                </Text>
              </View>
            ))}
          {section === 'Standings' &&
            Object.values(state.teams)
              .sort((a, b) => b.record.wins - a.record.wins)
              .map((t) => (
                <View key={t.abbr} style={s.card}>
                  <Text style={s.heading}>
                    {t.abbr} · {t.record.wins}–{t.record.losses}–{t.record.ties}
                  </Text>
                  <Text style={s.copy}>
                    {t.conference} {t.division} · PF {t.pointsFor} · PA {t.pointsAgainst}
                  </Text>
                </View>
              ))}
          {section === 'Transactions' && (
            <>
              {!state.transactions.length && <Text style={s.copy}>No transactions yet.</Text>}
              {state.transactions.map((t) => (
                <View key={t.id} style={s.card}>
                  <Text style={s.eyebrow}>{t.type}</Text>
                  <Text style={s.heading}>{t.playerName ?? t.teamAbbr}</Text>
                  <Text style={s.copy}>{t.summary}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  eyebrow: {
    color: '#AFC5D3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.7,
    marginTop: 16,
    marginBottom: 8,
  },
  title: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 38, lineHeight: 41 },
  heading: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 28 },
  copy: { color: '#AFC5D3', fontSize: 14, lineHeight: 21, marginVertical: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#36505B',
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#06222B',
    marginVertical: 10,
  },
  recommended: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  features: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12, gap: 12 },
  feature: { width: '46%', color: 'white', fontSize: 13 },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  error: { color: '#FFB4AB', paddingVertical: 12 },
  action: { color: 'white', fontWeight: '800', marginTop: 12 },
});
