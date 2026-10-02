import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DraftCentralHomeData, Prospect } from '../../../packages/front-office/draft-central';
import type { DraftSessionDTO } from '../../../src/types/draft';
import { largeDeviceStorage } from '../lib/large-device-storage';
import { SectionMenu } from './section-menu';
type Board = { ids: string[]; favorites: string[] };
export function FranchiseDraftViews({
  saveId,
  view,
  data,
  draft,
  onRoom,
}: {
  saveId: string;
  view: string;
  data: DraftCentralHomeData | null;
  draft: DraftSessionDTO | null;
  onRoom: () => void;
}) {
  const [board, setBoard] = useState<Board>({ ids: [], favorites: [] }),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [filter, setFilter] = useState('All Prospects'),
    [query, setQuery] = useState(''),
    [position, setPosition] = useState('ALL'),
    [school, setSchool] = useState('ALL'),
    [sort, setSort] = useState('Rank'),
    [selected, setSelected] = useState<Prospect | null>(null);
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [query, position, school, sort, view, filter]);
  const key = `dd-draft-board-${saveId}-${data?.draftYear ?? 0}`;
  useEffect(() => {
    if (!data) return;
    let active = true;
    setReady(false);
    setError('');
    void largeDeviceStorage
      .get(key)
      .then((raw) => {
        const value = JSON.parse(raw ?? '{"ids":[],"favorites":[]}');
        if (!Array.isArray(value.ids) || !Array.isArray(value.favorites)) throw new Error();
        if (active) {
          setBoard(value);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load your board. Reopen this section to retry.');
      });
    return () => {
      active = false;
    };
  }, [key, Boolean(data)]);
  async function persist(next: Board) {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await largeDeviceStorage.set(key, JSON.stringify(next));
      setBoard(next);
      setError('');
    } catch {
      setError('Unable to save your board. Your previous rankings were preserved.');
    } finally {
      setBusy(false);
    }
  }
  const toggle = (id: string, favorite = false) => {
    const field = favorite ? 'favorites' : 'ids';
    void persist({
      ...board,
      [field]: board[field].includes(id)
        ? board[field].filter((x) => x !== id)
        : [...board[field], id],
    });
  };
  const rows = useMemo(
    () =>
      (data?.prospects ?? [])
        .filter(
          (p) =>
            (filter !== 'My Big Board' || board.ids.includes(p.id)) &&
            (filter !== 'Favorites' || board.favorites.includes(p.id)) &&
            (position === 'ALL' || p.position === position) &&
            (school === 'ALL' || p.school === school) &&
            `${p.name} ${p.school ?? ''}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          filter === 'My Big Board'
            ? board.ids.indexOf(a.id) - board.ids.indexOf(b.id)
            : sort === 'Grade'
              ? b.scoutGrade - a.scoutGrade
              : sort === 'Stock Change'
                ? b.rankingTrend - a.rankingTrend
                : a.currentRank - b.currentRank,
        ),
    [data, filter, board, position, school, query, sort],
  );
  function move(id: string, delta: number) {
    const ids = [...board.ids],
      index = ids.indexOf(id),
      next = index + delta;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    void persist({ ...board, ids });
  }
  if (!data) return <ActivityIndicator color="white" />;
  return (
    <View>
      <Text style={s.heading}>{view.toUpperCase()}</Text>
      <Text style={s.copy}>
        {data.draftYear} DRAFT CLASS · {data.prospects.length} prospects
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.copy}>
          {error}
        </Text>
      )}
      {view === 'Team Needs' ? (
        <>
          <Text style={s.copy}>
            Understand the roster gaps that should shape your draft strategy.
          </Text>
          {data.needAnalysis.map((need) => (
            <View style={s.card} key={need.position}>
              <Text style={s.name}>
                {need.position} · {need.level} need
              </Text>
              <Text style={s.copy}>Need score {Math.round(need.score)}</Text>
            </View>
          ))}
          {data.recommendations.map((r, i) => (
            <View key={i} style={s.card}>
              <Text style={s.name}>{r.title}</Text>
              <Text style={s.copy}>{r.detail}</Text>
            </View>
          ))}
          <Text style={s.heading}>BEST FITS</Text>
          {data.fits.map((p) => (
            <Pressable key={p.id} style={s.card} onPress={() => setSelected(p)}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.copy}>
                {p.position} · {p.school} · Need fit {p.needFitScore ?? '—'}
              </Text>
            </Pressable>
          ))}
        </>
      ) : view === 'My Drafts' ? (
        <>
          {draft?.status === 'completed' ? (
            draft.picks
              .filter((p) => p.selectedByTeamAbbr === draft.userTeamAbbr)
              .map((p) => {
                const player = draft.prospects.find((x) => x.id === p.selectedPlayerId);
                return (
                  <View style={s.card} key={p.id}>
                    <Text style={s.meta}>
                      ROUND {p.round} · PICK {p.overall}
                    </Text>
                    <Text style={s.name}>
                      {player
                        ? `${player.firstName} ${player.lastName}`
                        : (p.selectedPlayerId ?? 'Unselected')}
                    </Text>
                    <Text style={s.copy}>Grade {p.grade ?? '—'}</Text>
                    {p.gradeReasons?.map((reason) => (
                      <Text key={reason} style={s.copy}>
                        {reason}
                      </Text>
                    ))}
                  </View>
                );
              })
          ) : (
            <View style={s.card}>
              <Text style={s.name}>No completed drafts yet</Text>
              <Text style={s.copy}>
                Your franchise draft classes and grades will appear here after the first draft is
                completed.
              </Text>
            </View>
          )}
          <Pressable style={s.button} onPress={onRoom}>
            <Text style={s.name}>Open Draft Room →</Text>
          </Pressable>
        </>
      ) : (
        <>
          {view === 'Draft Guide' && (
            <>
              <Text style={s.copy}>
                In-depth analysis, positional breakdowns, and expert insights to help you win draft
                day.
              </Text>
              <Text style={s.name}>CLASS DEPTH</Text>
              <View style={s.grid}>
                {[...new Set(data.prospects.map((p) => p.position))].filter(Boolean).map((pos) => (
                  <Pressable key={pos!} style={s.small} onPress={() => setPosition(pos!)}>
                    <Text style={s.name}>{pos}</Text>
                    <Text style={s.copy}>
                      {
                        data.prospects.filter((p) => p.position === pos && p.currentRank <= 100)
                          .length
                      }{' '}
                      in Top 100
                    </Text>
                  </Pressable>
                ))}
              </View>
              {data.news.map((n) => (
                <Pressable
                  style={s.card}
                  key={n.id}
                  onPress={() =>
                    setSelected(data.prospects.find((p) => p.id === n.prospectId) ?? null)
                  }
                >
                  <Text style={s.meta}>{n.category}</Text>
                  <Text style={s.name}>{n.headline}</Text>
                  <Text style={s.copy}>{n.summary}</Text>
                </Pressable>
              ))}
            </>
          )}
          <SectionMenu
            title={filter}
            items={['All Prospects', 'My Big Board', 'Favorites'].map((label) => ({
              label,
              selected: filter === label,
              onPress: () => setFilter(label),
            }))}
          />
          <TextInput
            style={s.input}
            accessibilityLabel="Search draft prospects"
            placeholder="Search name or school"
            placeholderTextColor="#A8BAC4"
            value={query}
            onChangeText={setQuery}
          />
          <SectionMenu
            title={`Position: ${position}`}
            items={[
              'ALL',
              ...new Set(data.prospects.map((p) => p.position).filter((p): p is string => !!p)),
            ].map((value) => ({
              label: value,
              selected: position === value,
              onPress: () => setPosition(value),
            }))}
          />
          <SectionMenu
            title={`School: ${school}`}
            items={[
              'ALL',
              ...new Set(data.prospects.map((p) => p.school).filter((p): p is string => !!p)),
            ].map((value) => ({
              label: value,
              selected: school === value,
              onPress: () => setSchool(value),
            }))}
          />
          <SectionMenu
            title={`Sort: ${sort}`}
            items={['Rank', 'Grade', 'Stock Change'].map((value) => ({
              label: value,
              selected: sort === value,
              onPress: () => setSort(value),
            }))}
          />
          {!!board.ids.length && (
            <Pressable
              style={s.button}
              onPress={() =>
                void Share.share({
                  message: `${data.draftYear} D&D Big Board\n${board.ids.map((id, i) => `${i + 1}. ${data.prospects.find((p) => p.id === id)?.name ?? id}`).join('\n')}`,
                }).catch(() => setError('Unable to share this board.'))
              }
            >
              <Text style={s.name}>Share my board ↗</Text>
            </Pressable>
          )}
          {rows.slice(0, limit).map((p) => (
            <View style={s.card} key={p.id}>
              <Pressable onPress={() => setSelected(p)} style={s.row}>
                {p.headshotUrl && <Image source={{ uri: p.headshotUrl }} style={s.avatar} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.meta}>
                    #{p.currentRank} · {p.position}
                  </Text>
                  <Text style={s.name}>{p.name}</Text>
                  <Text style={s.copy}>
                    {p.school} · Grade {p.scoutGrade ?? '—'}
                  </Text>
                  <Text style={s.copy}>
                    Projected picks {p.projectedPickLow}–{p.projectedPickHigh} · Stock{' '}
                    {p.rankingTrend > 0 ? '+' : ''}
                    {p.rankingTrend}
                  </Text>
                </View>
              </Pressable>
              <View style={s.row}>
                <Pressable style={s.button} disabled={!ready || busy} onPress={() => toggle(p.id)}>
                  <Text style={s.name}>
                    {board.ids.includes(p.id) ? '✓ On board' : '＋ Add to board'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Favorite ${p.name}`}
                  style={s.button}
                  disabled={!ready || busy}
                  onPress={() => toggle(p.id, true)}
                >
                  <Text style={s.name}>{board.favorites.includes(p.id) ? '★' : '☆'}</Text>
                </Pressable>
                {filter === 'My Big Board' && (
                  <>
                    <Pressable
                      style={s.button}
                      disabled={busy}
                      accessibilityLabel={`Move ${p.name} up`}
                      onPress={() => move(p.id, -1)}
                    >
                      <Text style={s.name}>↑</Text>
                    </Pressable>
                    <Pressable
                      style={s.button}
                      disabled={busy}
                      accessibilityLabel={`Move ${p.name} down`}
                      onPress={() => move(p.id, 1)}
                    >
                      <Text style={s.name}>↓</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ))}
          {rows.length > limit && (
            <Pressable style={s.button} onPress={() => setLimit(limit + 50)}>
              <Text style={s.copy}>
                Show more prospects ({limit} of {rows.length})
              </Text>
            </Pressable>
          )}
          {!rows.length && <Text style={s.copy}>No prospects match this view.</Text>}
        </>
      )}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.modal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close prospect"
            style={s.button}
            onPress={() => setSelected(null)}
          >
            <Text style={s.name}>← Back to draft</Text>
          </Pressable>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {selected && (
              <>
                {selected.headshotUrl && (
                  <Image source={{ uri: selected.headshotUrl }} style={s.portrait} />
                )}
                <Text style={s.heading}>{selected.name}</Text>
                <Text style={s.copy}>
                  {selected.position} · {selected.school}
                </Text>
                <View style={s.card}>
                  <Text style={s.name}>SCOUTING REPORT</Text>
                  <Text style={s.copy}>
                    {selected.summary ?? 'A scouting summary is not available for this prospect.'}
                  </Text>
                  <Text style={s.copy}>
                    Rank #{selected.currentRank} · Grade {selected.scoutGrade}
                  </Text>
                  <Text style={s.copy}>
                    {selected.height ?? '—'} · {selected.weight ?? '—'} lbs ·{' '}
                    {selected.conference ?? '—'}
                  </Text>
                  <Text style={s.copy}>
                    Projected picks {selected.projectedPickLow}–{selected.projectedPickHigh}
                  </Text>
                </View>
                <Pressable
                  disabled={!ready || busy}
                  style={s.button}
                  onPress={() => toggle(selected.id)}
                >
                  <Text style={s.name}>
                    {board.ids.includes(selected.id) ? 'Remove from board' : 'Add to my board'}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontFamily: 'BarlowCondensed', fontSize: 32, color: 'white', marginVertical: 12 },
  name: { fontWeight: '800', fontSize: 16, color: 'white' },
  copy: { color: '#B4C6D1', fontSize: 14, lineHeight: 22, marginVertical: 8 },
  meta: { color: '#FFB81C', fontSize: 12, marginVertical: 8 },
  card: {
    padding: 18,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#23414E',
    borderRadius: 10,
    backgroundColor: '#061D2B',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { width: '47%', padding: 14, backgroundColor: '#061D2B', borderRadius: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#34505F',
    borderRadius: 8,
    padding: 14,
    color: 'white',
    marginVertical: 12,
  },
  button: {
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#23414E',
    borderRadius: 8,
    marginVertical: 8,
  },
  avatar: { width: 55, height: 55, borderRadius: 27.5, resizeMode: 'cover' },
  portrait: { width: '100%', height: 205, resizeMode: 'contain' },
  modal: { flex: 1, backgroundColor: '#001222' },
});
