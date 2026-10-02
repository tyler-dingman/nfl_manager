import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticatedFetch } from '../lib/auth';
import { deviceStorage } from '../lib/device-storage';
import { useTeamBranding } from '../lib/team-branding';
import {
  newsPersona,
  newsCategory,
  defaultNewsPreferences,
  type NewsPreferences,
} from '../../../src/lib/front-office-news-presentation';
import type { FrontOfficeEvent } from '../../../src/types/front-office';
export function FranchiseNewsFeed({
  saveId,
  preview = false,
}: {
  saveId: string;
  preview?: boolean;
}) {
  const { teamId } = useTeamBranding();
  const [expanded, setExpanded] = useState(!preview),
    [settings, setSettings] = useState(false),
    [filter, setFilter] = useState('all'),
    [category, setCategory] = useState(''),
    [query, setQuery] = useState('');
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]),
    [next, setNext] = useState<number | null>(null),
    [selected, setSelected] = useState<FrontOfficeEvent | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [counts, setCounts] = useState<any>({
    all: 0,
    team: 0,
    league: 0,
    breaking: 0,
    categories: [],
  });
  const [prefs, setPrefs] = useState<NewsPreferences>(defaultNewsPreferences);
  const key = `fo-news-preferences:${saveId}`;
  useEffect(() => {
    void deviceStorage.get(key).then((v) => {
      if (v) {
        try {
          setPrefs({ ...defaultNewsPreferences, ...JSON.parse(v) });
        } catch {}
      }
    });
  }, [key]);
  const pref = (value: NewsPreferences) => {
    setPrefs(value);
    void deviceStorage.set(key, JSON.stringify(value));
  };
  async function load(offset = 0, signal?: AbortSignal) {
    setBusy(true);
    setError('');
    try {
      const r = await authenticatedFetch(
        `/api/front-office/events?saveId=${encodeURIComponent(saveId)}&notifications=1&limit=${expanded ? 20 : 10}&offset=${offset}&filter=${filter}&category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`,
        { signal },
      );
      if (!r.ok) throw new Error('Unable to load News.');
      const p = await r.json();
      setEvents((old) =>
        offset ? [...new Map([...old, ...p.events].map((e) => [e.id, e])).values()] : p.events,
      );
      setCounts(p.counts);
      setNext(p.nextOffset);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Unable to load News.');
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => void load(0, c.signal), 150);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [saveId, filter, category, query, expanded, refresh]);
  async function read(e: FrontOfficeEvent) {
    setSelected(e);
    await authenticatedFetch(`/api/front-office/events/${encodeURIComponent(e.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read' }),
    });
    setEvents((old) =>
      old.map((v) => (v.id === e.id ? { ...v, readAt: new Date().toISOString() } : v)),
    );
  }
  return (
    <View style={s.root}>
      <Text style={s.title}>News</Text>
      <ScrollView horizontal>
        {['all', 'team', 'league', 'breaking'].map((f) => (
          <Pressable
            accessibilityRole="button"
            key={f}
            style={[s.tab, filter === f && s.active]}
            onPress={() => setFilter(f)}
          >
            <Text style={s.white}>
              {f === 'team' ? 'My Team' : f[0].toUpperCase() + f.slice(1)} {counts[f]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {expanded && (
        <>
          <TextInput
            accessibilityLabel="Search news"
            placeholder="Search player, team, headline or category…"
            placeholderTextColor="#9bb6c4"
            style={s.input}
            value={query}
            onChangeText={setQuery}
          />
          <ScrollView horizontal>
            <Pressable style={s.tab} onPress={() => setCategory('')}>
              <Text style={s.white}>All categories</Text>
            </Pressable>
            {counts.categories.map((c: any) => (
              <Pressable
                key={c.category}
                style={[s.tab, category === c.category && s.active]}
                onPress={() => setCategory(c.category)}
              >
                <Text style={s.white}>
                  {c.category} {c.count}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {busy && <Text style={s.muted}>Loading News…</Text>}
      {error && (
        <Pressable onPress={() => setRefresh((v) => v + 1)}>
          <Text style={s.muted}>{error} Tap to retry.</Text>
        </Pressable>
      )}
      {events.map((e) => (
        <Pressable
          accessibilityRole="button"
          key={e.id}
          style={s.card}
          onPress={() => void read(e)}
        >
          <View style={s.avatar}>
            <Text style={s.white}>D&D</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.source}>{newsPersona(e)}</Text>
            <Text style={s.muted}>
              Simulated league · {e.teamAbbr} · {newsCategory(e)}
            </Text>
            <Text style={s.copy}>{e.headline}</Text>
            {expanded && e.summary !== e.headline && <Text style={s.muted}>{e.summary}</Text>}
            <Text style={s.muted}>{e.readAt ? 'Read story' : '● Unread · Read story'} →</Text>
          </View>
        </Pressable>
      ))}
      {!busy && !events.length && (
        <Text style={s.muted}>
          No matching news yet. Advance your franchise to build its news history.
        </Text>
      )}
      {!expanded ? (
        <Pressable style={s.tab} onPress={() => setExpanded(true)}>
          <Text style={s.white}>View All News →</Text>
        </Pressable>
      ) : (
        next !== null && (
          <Pressable disabled={busy} style={s.tab} onPress={() => void load(next)}>
            <Text style={s.white}>Load more news</Text>
          </Pressable>
        )
      )}
      <Pressable
        style={s.tab}
        onPress={() => {
          void authenticatedFetch('/api/front-office/events', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saveId, action: 'read-all' }),
          }).then(() => setRefresh((v) => v + 1));
        }}
      >
        <Text style={s.white}>Mark all as read</Text>
      </Pressable>
      <Pressable style={s.tab} onPress={() => setSettings((v) => !v)}>
        <Text style={s.white}>Notification settings</Text>
      </Pressable>
      {settings && (
        <View style={s.settings}>
          <Text style={s.source}>Popup preferences</Text>
          <Text style={s.muted}>All news remains in your feed.</Text>
          {(['myTeam', 'league', 'injuries', 'game'] as const).map((k) => (
            <View key={k} style={s.setting}>
              <Text style={s.white}>
                {
                  {
                    myTeam: 'My Team roster moves',
                    league: 'League news',
                    injuries: 'Injuries',
                    game: 'Game news',
                  }[k]
                }
              </Text>
              <Switch
                accessibilityLabel={k}
                value={prefs[k]}
                onValueChange={(v) => pref({ ...prefs, [k]: v })}
              />
            </View>
          ))}
          {(['normal', 'important', 'minimal'] as const).map((f) => (
            <Pressable
              key={f}
              style={[s.tab, prefs.frequency === f && s.active]}
              onPress={() => pref({ ...prefs, frequency: f })}
            >
              <Text style={s.white}>
                {f === 'normal'
                  ? 'Normal (recommended)'
                  : f === 'important'
                    ? 'Important only'
                    : 'Minimal'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal visible={!!selected} onRequestClose={() => setSelected(null)} animationType="slide">
        <SafeAreaView style={s.root}>
          <Pressable style={s.tab} onPress={() => setSelected(null)}>
            <Text style={s.white}>← Back to News</Text>
          </Pressable>
          <ScrollView>
            {selected && (
              <View style={s.settings}>
                <Text style={s.source}>{newsPersona(selected)}</Text>
                <Text style={s.title}>{selected.headline}</Text>
                <Text style={s.copy}>{selected.summary}</Text>
                <Text style={s.muted}>D&D simulated league · Week {selected.simulationWeek}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { backgroundColor: '#03151d', padding: 12, flexGrow: 1 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', marginVertical: 14 },
  white: { color: '#eff5f7' },
  tab: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#29434e',
    borderRadius: 8,
    margin: 3,
    minHeight: 44,
  },
  active: { backgroundColor: '#19333f' },
  input: {
    color: 'white',
    backgroundColor: '#09212a',
    borderColor: '#2b4855',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#203943',
    backgroundColor: '#061b24',
    borderRadius: 10,
    marginVertical: 6,
  },
  avatar: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#173844',
    alignItems: 'center',
    justifyContent: 'center',
  },
  source: { fontSize: 13, fontWeight: '700', color: 'white' },
  muted: { color: '#9bb6c4', fontSize: 12, lineHeight: 18, marginVertical: 5 },
  copy: { color: '#eff5f7', fontSize: 15, lineHeight: 22, marginVertical: 8 },
  settings: {
    padding: 16,
    backgroundColor: '#061b24',
    borderWidth: 1,
    borderColor: '#29434e',
    borderRadius: 10,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
