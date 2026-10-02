import { PlayerTransactionWorkspace } from './player-transaction-workspace';
import type { ExpiringContractRow } from '../../../src/lib/expiring-contracts';
import { playerDevelopmentTrends } from '../../../src/lib/player-development-trends';
import type { FranchiseSimulationState } from '../../../src/types/front-office';
import { FranchiseDraftViews } from './franchise-draft-views';
import { ratingChange, compareDevelopmentPlayers } from '../../../src/lib/player-development-sort';
import { useCallback, useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticatedFetch } from '../lib/auth';
import { useTeamBranding } from '../lib/team-branding';
import type { PlayerRowDTO } from '../../../src/types/player';
import type { DraftSessionDTO } from '../../../src/types/draft';
import type { DraftCentralHomeData } from '../../../packages/front-office/draft-central';
import { SectionMenu } from './section-menu';
export async function franchiseRequest<T>(path: string, body?: object): Promise<T> {
  const response = await authenticatedFetch(
    path,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok || result.ok === false)
    throw new Error(result.error ?? 'Unable to update your franchise.');
  if (Array.isArray(result.events) && result.events.length && body)
    DeviceEventEmitter.emit('front-office-news-updated', {
      events: result.events,
      saveId: (body as any).saveId,
      teamAbbr: (body as any).teamAbbr ?? (body as any).teamId,
    });
  return result;
}
export function FranchiseRoster({
  saveId,
  section,
  phase,
  completedDraft,
  simulation,
  onDraftComplete,
  initialPlayerId,
}: {
  initialPlayerId?: string;
  saveId: string;
  section: 'Roster' | 'Free Agency' | 'Draft' | 'Development';
  phase: string;
  completedDraft?: DraftSessionDTO;
  simulation?: FranchiseSimulationState;
  onDraftComplete: () => Promise<void>;
}) {
  const { teamId, theme } = useTeamBranding();
  const [players, setPlayers] = useState<PlayerRowDTO[]>([]);
  const [draftView, setDraftView] = useState('Draft Central');
  const [draftData, setDraftData] = useState<DraftCentralHomeData | null>(null);
  const [draft, setDraft] = useState<DraftSessionDTO | null>(null);
  const [developmentFilter, setDevelopmentFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('All');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlayerRowDTO | null>(null);
  const [openedHeroId, setOpenedHeroId] = useState<string>();
  useEffect(() => {
    if (!initialPlayerId || openedHeroId === initialPlayerId) return;
    const player = players.find((p) => p.id === initialPlayerId);
    if (player) {
      setSelected(player);
      setOpenedHeroId(initialPlayerId);
    }
  }, [initialPlayerId, openedHeroId, players]);
  const [years, setYears] = useState('1');
  const [apy, setApy] = useState('6');
  const [guaranteed, setGuaranteed] = useState('0');
  const [response, setResponse] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = `saveId=${encodeURIComponent(saveId)}&teamAbbr=${teamId}`;
      if (section === 'Draft') {
        const result = await franchiseRequest<{ session: DraftSessionDTO | null }>(
          `/api/draft/session/active?${params}`,
        );
        const central = await franchiseRequest<DraftCentralHomeData>(
          `/api/front-office/draft-central?${params}`,
        );
        setDraftData(central);
        setDraft(result.session ?? completedDraft ?? null);
        setPlayers(
          result.session?.prospects ??
            completedDraft?.prospects ??
            central.prospects.map((p) => ({
              id: p.id,
              firstName: p.name.split(' ').slice(0, -1).join(' '),
              lastName: p.name.split(' ').at(-1) ?? p.name,
              position: p.position ?? '—',
              school: p.school,
              headshotUrl: p.headshotUrl,
              summary: p.summary,
              rank: p.currentRank,
              rating: p.overall ?? undefined,
              contractYearsRemaining: 0,
              capHit: 'Prospect',
              status: 'Prospect',
            })),
        );
      } else {
        const result = await franchiseRequest<PlayerRowDTO[] | { players: PlayerRowDTO[] }>(
          `/api/${section === 'Free Agency' ? 'free-agents' : 'roster'}?${params}`,
        );
        const rows = Array.isArray(result) ? result : result.players;
        if (section === 'Roster' && phase === 'resign_cut') {
          const pending = await franchiseRequest<{ players: ExpiringContractRow[] }>(
            `/api/contracts/expiring?${params}`,
          );
          const extra = pending.players
            .filter((p) => !rows.some((r) => r.id === p.id))
            .map(
              (p): PlayerRowDTO => ({
                id: p.id,
                firstName: p.name.split(' ')[0],
                lastName: p.name.split(' ').slice(1).join(' '),
                position: p.pos,
                headshotUrl: p.headshotUrl,
                age: p.age,
                rating: p.rating,
                contractYearsRemaining: 0,
                capHit: 'Expiring',
                status: 'Expiring',
              }),
            );
          setPlayers([...rows, ...extra]);
        } else setPlayers(rows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load players.');
    } finally {
      setLoading(false);
    }
  }, [saveId, teamId, section]);
  useEffect(() => {
    setSelected(null);
    setQuery('');
    setPosition('All');
    void load();
  }, [load]);
  async function draftAction(action: 'start' | 'advance' | 'pick', playerId?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await franchiseRequest<{ session: DraftSessionDTO }>(
        `/api/draft/session/${action}`,
        {
          saveId,
          draftSessionId: draft?.id,
          playerId,
          ...(action === 'start' ? { mode: 'real', maxRounds: 7 } : {}),
        },
      );
      setDraft(result.session);
      setPlayers(result.session.prospects);
      setSelected(null);
      if (result.session.status === 'completed') await onDraftComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update draft.');
    } finally {
      setBusy(false);
    }
  }
  async function offer() {
    if (!selected || busy) return;
    const values = { years: Number(years), apy: Number(apy), guaranteed: Number(guaranteed) };
    if (
      !Number.isInteger(values.years) ||
      values.years < 1 ||
      values.years > 6 ||
      !Number.isFinite(values.apy) ||
      values.apy <= 0 ||
      !Number.isFinite(values.guaranteed) ||
      values.guaranteed < 0
    ) {
      setResponse('Enter 1–6 years, a positive annual value, and a valid guarantee.');
      return;
    }
    setBusy(true);
    setResponse('');
    try {
      const result = await franchiseRequest<{
        accepted?: boolean;
        message?: string;
        notice?: string;
        quote?: string;
      }>(section === 'Free Agency' ? '/api/actions/offer-contract' : '/api/actions/re-sign', {
        saveId,
        teamAbbr: teamId,
        playerId: selected.id,
        ...values,
      });
      setResponse(
        result.message ??
          result.notice ??
          result.quote ??
          (result.accepted ? 'Offer accepted.' : 'Offer declined.'),
      );
      if (result.accepted) await load();
    } catch (e) {
      setResponse(e instanceof Error ? e.message : 'Unable to submit offer.');
    } finally {
      setBusy(false);
    }
  }
  const picked = new Set(draft?.picks.map((p) => p.selectedPlayerId).filter(Boolean));
  const current = draft?.picks[draft.currentPickIndex];
  const trends = playerDevelopmentTrends(players, simulation, teamId);
  const developmentRows =
    section === 'Development'
      ? players
          .filter((p) => {
            const change = trends.get(p.id)?.direction ?? 0;
            return (
              p.status?.toLowerCase() !== 'cut' &&
              (developmentFilter === 'all' ||
                (developmentFilter === 'young' && (p.age ?? 100) <= 25) ||
                (developmentFilter === 'up' && change !== null && change > 0) ||
                (developmentFilter === 'down' && change !== null && change < 0))
            );
          })
          .sort((a, b) => compareDevelopmentPlayers(a, b, 'Change', 'desc'))
      : players;
  const visible = developmentRows.filter(
    (p) =>
      (section !== 'Draft' || !picked.has(p.id)) &&
      (position === 'All' || p.position === position) &&
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const draftMenu = (
    <SectionMenu
      navigation={{ inset: 16 }}
      title="Draft sections"
      items={[
        'Draft Central',
        'Big Board',
        'Position Rankings',
        'Draft Guide',
        'Team Needs',
        'My Drafts',
        'Draft Room',
      ].map((label) => ({
        label,
        selected: draftView === label,
        onPress: () => setDraftView(label),
      }))}
    />
  );
  if (section === 'Draft' && !['Draft Central', 'Draft Room'].includes(draftView))
    return (
      <View>
        {draftMenu}
        {error ? (
          <Pressable style={s.card} onPress={() => void load()}>
            <Text style={s.error}>{error}</Text>
            <Text style={s.name}>Try again →</Text>
          </Pressable>
        ) : (
          <FranchiseDraftViews
            saveId={saveId}
            view={draftView}
            data={draftData}
            draft={draft}
            onRoom={() => setDraftView('Draft Room')}
          />
        )}
      </View>
    );
  return (
    <View>
      {section === 'Draft' && draftMenu}
      <Text style={s.heading}>{section === 'Draft' ? 'NFL DRAFT' : section.toUpperCase()}</Text>
      <Text style={s.copy}>
        {section === 'Free Agency'
          ? 'Find talent. Create opportunity.'
          : section === 'Draft'
            ? 'Build the future of your franchise.'
            : 'Manage the players shaping your season.'}
      </Text>
      {loading && <ActivityIndicator color="white" />}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {section === 'Draft' && draftData && (
        <View style={s.card}>
          <Text style={s.heading}>{draftData.draftYear} DRAFT CENTRAL</Text>
          <Text style={s.copy}>
            YOUR PICKS ·{' '}
            {draftData.picks.map((p) => `R${p.round} #${p.displayOverall}`).join(' · ')}
          </Text>
          <Text style={s.copy}>TEAM NEEDS · {draftData.needs.join(' · ')}</Text>
          {draftData.recommendations.map((r, i) => (
            <View key={i}>
              <Text style={s.name}>{r.title}</Text>
              <Text style={s.copy}>{r.detail}</Text>
            </View>
          ))}
        </View>
      )}
      {section === 'Draft' && !draft && !loading && (
        <Pressable
          disabled={busy || phase !== 'draft'}
          style={[
            s.button,
            { backgroundColor: theme.primaryFill },
            phase !== 'draft' && { opacity: 0.5 },
          ]}
          onPress={() => void draftAction('start')}
        >
          <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>
            {phase === 'draft' ? 'ENTER DRAFT ROOM' : 'Draft opens in the NFL Draft phase'}
          </Text>
        </Pressable>
      )}
      {draft && section === 'Draft' && (
        <View style={s.card}>
          <Text style={s.heading}>
            {draft.status === 'completed'
              ? 'DRAFT COMPLETE'
              : `${current?.ownerTeamAbbr ?? '—'} ON THE CLOCK`}
          </Text>
          <Text style={s.copy}>
            Round {current?.round ?? draft.maxRounds} · Pick{' '}
            {current?.overall ?? draft.picks.length}
          </Text>
          {draft.status !== 'completed' && current?.ownerTeamAbbr !== teamId && (
            <Pressable disabled={busy} style={s.button} onPress={() => void draftAction('advance')}>
              <Text style={s.buttonText}>{busy ? 'SIMULATING…' : 'ADVANCE TO NEXT PICK'}</Text>
            </Pressable>
          )}
        </View>
      )}
      {section === 'Development' && (
        <>
          <Text style={s.copy}>
            Review current ratings, baseline changes, and the young talent on your roster.
          </Text>
          <SectionMenu
            title="Development filters"
            items={[
              ['all', 'All Players'],
              ['up', 'Trending Up'],
              ['down', 'Trending Down'],
              ['young', 'Age 25 & Under'],
            ].map(([id, label]) => ({
              label,
              selected: developmentFilter === id,
              onPress: () => setDevelopmentFilter(id),
            }))}
          />
          <Text style={s.copy}>
            Changes compare current ratings with the stored baseline. A dash means no baseline is
            available.
          </Text>
        </>
      )}
      {!!players.length && (
        <>
          <TextInput
            accessibilityLabel="Search players"
            value={query}
            onChangeText={setQuery}
            placeholder="Search players…"
            placeholderTextColor="#9BAFB7"
            style={s.input}
          />
          <SectionMenu
            title={`Position: ${position}`}
            items={['All', ...new Set(players.map((p) => p.position))].map((p) => ({
              label: p,
              selected: p === position,
              onPress: () => setPosition(p),
            }))}
          />
        </>
      )}
      {!loading && !error && !!players.length && !visible.length && (
        <Text style={s.copy}>No players match these filters.</Text>
      )}
      {visible.map((player) => (
        <Pressable
          key={player.id}
          style={s.player}
          onPress={() => {
            setSelected(player);
            setResponse('');
            setApy(String(player.expectedAnnualValue ?? 6));
          }}
        >
          <Image
            source={player.headshotUrl ? { uri: player.headshotUrl } : undefined}
            style={s.portrait}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>
              {player.firstName} {player.lastName}
            </Text>
            <Text style={s.copy}>
              {player.position} ·{' '}
              {player.age ? `Age ${player.age}` : (player.school ?? player.college ?? '')}
            </Text>
            <Text style={s.copy}>
              {section === 'Development'
                ? (trends.get(player.id)?.reason ?? 'Stable development outlook')
                : section === 'Free Agency'
                  ? `Expected $${player.expectedAnnualValue ?? '—'}M / yr`
                  : player.capHit}
            </Text>
          </View>
          <Text style={s.rating}>{player.rating ?? player.rank ?? '—'}</Text>
        </Pressable>
      ))}
      {draft?.status === 'completed' &&
        section === 'Draft' &&
        draft.picks
          .filter((p) => p.selectedByTeamAbbr === teamId)
          .map((p) => (
            <View style={s.card} key={p.id}>
              <Text style={s.name}>
                Round {p.round} · Pick {p.overall}
              </Text>
              <Text style={s.copy}>
                {players.find((player) => player.id === p.selectedPlayerId)?.firstName}{' '}
                {players.find((player) => player.id === p.selectedPlayerId)?.lastName} ·{' '}
                {p.grade ?? ''}
              </Text>
            </View>
          ))}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.modal}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {selected && (section === 'Roster' || section === 'Free Agency') ? (
              <PlayerTransactionWorkspace
                key={selected.id}
                player={selected}
                team={teamId}
                signing={section === 'Free Agency'}
                season={simulation?.season ?? 2026}
                roster={players}
                years={years}
                apy={apy}
                guaranteed={guaranteed}
                setYears={setYears}
                setApy={setApy}
                setGuaranteed={setGuaranteed}
                busy={busy}
                response={response || error}
                onOffer={() => void offer()}
                onRelease={() => {
                  if (!busy)
                    Alert.alert(
                      'Release player?',
                      `Release ${selected.firstName} ${selected.lastName} from your roster? Dead money may remain against your cap.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Release',
                          style: 'destructive',
                          onPress: () => {
                            setBusy(true);
                            void franchiseRequest('/api/actions/cut-player', {
                              saveId,
                              playerId: selected.id,
                              teamAbbr: teamId,
                            })
                              .then(async () => {
                                setSelected(null);
                                await load();
                              })
                              .catch((e) =>
                                setResponse(
                                  e instanceof Error ? e.message : 'Unable to release player.',
                                ),
                              )
                              .finally(() => setBusy(false));
                          },
                        },
                      ],
                    );
                }}
                onClose={() => setSelected(null)}
              />
            ) : (
              <>
                <Pressable
                  accessibilityLabel="Close player details"
                  style={s.button}
                  onPress={() => setSelected(null)}
                >
                  <Text style={s.buttonText}>CLOSE ✕</Text>
                </Pressable>
                {selected && (
                  <>
                    <Image
                      source={selected.headshotUrl ? { uri: selected.headshotUrl } : undefined}
                      style={s.heroPortrait}
                    />
                    <Text style={s.heading}>
                      {selected.firstName} {selected.lastName}
                    </Text>
                    <Text style={s.copy}>
                      {selected.position} ·{' '}
                      {selected.age ? `Age ${selected.age}` : (selected.school ?? '')} ·{' '}
                      {selected.rating ?? '—'} OVR
                    </Text>
                    <Text style={s.copy}>{selected.summary}</Text>
                    {section === 'Draft' ? (
                      <Pressable
                        disabled={
                          busy ||
                          !draft ||
                          current?.ownerTeamAbbr !== teamId ||
                          draft?.status === 'completed'
                        }
                        style={s.button}
                        onPress={() => void draftAction('pick', selected.id)}
                      >
                        <Text style={s.buttonText}>DRAFT PLAYER</Text>
                      </Pressable>
                    ) : (
                      <View style={s.card}>
                        <Text style={s.heading}>CONTRACT</Text>
                        <Text style={s.copy}>
                          Cap hit {selected.capHit} · {selected.contractYearsRemaining} years
                          remaining
                        </Text>
                        <Text style={s.copy}>{selected.status}</Text>
                      </View>
                    )}
                    {!!response && (
                      <Text accessibilityRole="alert" style={s.copy}>
                        {response}
                      </Text>
                    )}
                    {!!error && (
                      <Text accessibilityRole="alert" style={s.error}>
                        {error}
                      </Text>
                    )}
                  </>
                )}{' '}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontFamily: 'BarlowCondensed', fontSize: 30, color: 'white', marginTop: 16 },
  copy: { color: '#9BAFB7', fontSize: 13, lineHeight: 21, marginVertical: 5 },
  error: { color: '#FFB4AB', marginVertical: 12 },
  card: {
    backgroundColor: '#091A20',
    borderWidth: 1,
    borderColor: '#263F48',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#36505B',
    borderRadius: 8,
    padding: 14,
    color: 'white',
    marginVertical: 12,
    minHeight: 48,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#263F48',
    backgroundColor: '#091A20',
  },
  portrait: { width: 52, height: 52, borderRadius: 26, resizeMode: 'cover' },
  name: { fontSize: 16, fontWeight: '800', color: 'white' },
  rating: { fontFamily: 'BarlowCondensed', fontSize: 28, color: '#F6C453' },
  button: {
    backgroundColor: '#263F48',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  buttonText: { color: 'white', fontWeight: '800' },
  modal: { flex: 1, backgroundColor: '#06121E' },
  heroPortrait: { height: 205, width: '100%', resizeMode: 'contain' },
});
