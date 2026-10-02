import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { GifPicker, PostedGif, gifProvider } from '../components/huddle-gif';
import { toGifReference, type GifItem } from '../../../packages/gifs';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../lib/auth-context';
import { DailyHero, DailyUpdate, DailyPoll, DailyCommunity } from '../components/huddle-daily';
import { ArchiveCommunity, ArchivePoll } from '../components/huddle-archive';
import { dailyDate, dailyEntries } from '../../../packages/huddle/daily';
import { HuddleField } from '../components/huddle-field';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useTeam } from '../lib/team-context';
import { authenticatedFetch } from '../lib/auth';
import { teamLogoAssets } from '../lib/team-logo-assets';
import { getOnboardingTheme } from '../lib/onboarding-theme';
import { createUseHuddle } from '../../../packages/huddle/use-huddle';
import {
  filterPlays,
  relativeTime,
  type Game,
  type PlayFilter,
  type Message,
} from '../../../packages/huddle';
import { TEAM_LIST } from '../../../src/data/teams';
const useHuddle = createUseHuddle({ useCallback, useEffect, useRef, useState });
const isActive = () => AppState.currentState === 'active';
export default function Huddle({ archive = false }: { archive?: boolean } = {}) {
  const { user } = useAuth();
  const [attachment, setAttachment] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifPlaybackVersion, setGifPlaybackVersion] = useState(0);
  const [gifOpen, setGifOpen] = useState(false),
    [selectedGif, setSelectedGif] = useState<GifItem | null>(null),
    [gifQuery, setGifQuery] = useState(''),
    [replyTo, setReplyTo] = useState<string | undefined>();
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) {
        setAttachment(result.assets[0].uri);
        setSelectedGif(null);
      }
    } catch {
      setNotice('Unable to open your photos. Please try again.');
    }
  };
  const { teamId } = useTeam(),
    params = useLocalSearchParams<{
      team?: string;
      mode?: string;
      date?: string;
      game?: string;
      discussion?: string;
      play?: string;
    }>();
  const team = TEAM_LIST.find((t) => t.abbr === params.team)?.abbr ?? teamId;
  const theme = getOnboardingTheme(team),
    query = new URLSearchParams({
      team,
      ...(archive ? { archive: '1', date: params.date ?? '2026-09-27' } : {}),
      teamName: TEAM_LIST.find((t) => t.abbr === team)?.name ?? team,
      ...(params.mode ? { mode: params.mode } : {}),
      ...(params.game ? { game: params.game } : {}),
      ...(params.discussion ? { discussion: params.discussion } : {}),
    }).toString();
  const { data, error, busy, act, load, simulator } = useHuddle(
      query,
      authenticatedFetch,
      isActive,
    ),
    [tab, setTab] = useState('Live'),
    [filter, setFilter] = useState<PlayFilter>('All Plays'),
    [draft, setDraft] = useState(''),
    [options, setOptions] = useState<Message | null>(null),
    [report, setReport] = useState(''),
    [notice, setNotice] = useState(''),
    [playContext, setPlayContext] = useState<string | null>(params.play ?? null);
  const composerInput = useRef<TextInput>(null);
  const replyInput = useRef<TextInput>(null);
  const [replyHeight, setReplyHeight] = useState(84);
  const [composerFocused, setComposerFocused] = useState(false);
  const daily = data?.game ? undefined : data?.daily;
  const archived = archive || daily?.status === 'ARCHIVED';
  const scroll = useRef<ScrollView>(null),
    atLive = useRef(true),
    seen = useRef(new Set<string>()),
    playSeen = useRef(new Set<string>()),
    [updates, setUpdates] = useState({ plays: 0, messages: 0 });
  useEffect(() => {
    seen.current = new Set();
    playSeen.current = new Set();
    setUpdates({ plays: 0, messages: 0 });
  }, [query]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (v) => {
      if (v === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);
  useEffect(() => {
    if (!data || data.daily?.fixture) return;
    const count = data.messages.filter((m) => !seen.current.has(m.id)).length,
      play = data.game?.plays.at(-1)?.id ?? null;
    const newPlay = (data.game?.plays ?? []).filter((p) => !playSeen.current.has(p.id)).length;
    if (seen.current.size && !data.historyPage && !atLive.current)
      setUpdates((x) => ({
        messages: x.messages + count,
        plays: x.plays + newPlay,
      }));
    else if (seen.current.size && !data.historyPage && atLive.current)
      scroll.current?.scrollToEnd({ animated: false });
    seen.current = new Set(data.messages.map((m) => m.id));
    playSeen.current = new Set((data.game?.plays ?? []).map((p) => p.id));
  }, [data]);
  const perform = async (b: object) => {
    if (await act(b)) {
      setOptions(null);
      setReport('');
      setNotice(
        data?.daily?.fixture ? 'Preview only — no changes were saved to a server.' : 'Saved.',
      );
    }
  };
  const game = data?.game,
    view = game || daily ? tab : tab === 'Live' ? 'Chat' : tab,
    plays = filterPlays(game ?? null, filter),
    latest = game?.plays.at(-1);
  const button = (label: string, onPress: () => void, active = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        s.pill,
        daily && { flex: 1, alignItems: 'center' },
        active && { backgroundColor: theme.primaryCTA, borderColor: theme.accent },
      ]}
    >
      <Text style={[s.text, active && { color: theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
  const renderComposer = () => (
    <View style={replyTo ? s.inlineReply : undefined}>
      {emojiOpen && (
        <View style={s.emojiTray}>
          {['🏈', '🔥', '👏', '🙌', '💪', '😂', '🎉', '❤️'].map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Insert ${emoji}`}
              style={s.icon}
              onPress={() => {
                setDraft((d) => (d + emoji).slice(0, 1000));
                setEmojiOpen(false);
              }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {attachment && (
        <View style={s.emojiTray}>
          <Image source={{ uri: attachment }} style={{ width: 70, height: 60, borderRadius: 8 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove image"
            style={s.icon}
            onPress={() => setAttachment(null)}
          >
            <Ionicons name="close" size={22} color="white" />
          </Pressable>
        </View>
      )}
      {replyTo && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text style={s.small}>
            Replying to {data?.messages.find((m) => m.id === replyTo)?.name ?? 'message'}
          </Text>
        </View>
      )}
      {replyTo && (
        <TextInput
          ref={replyInput}
          autoFocus
          multiline
          accessibilityLabel="Write your reply"
          placeholder="Write your reply..."
          placeholderTextColor="#a8bac4"
          maxLength={1000}
          value={draft}
          onChangeText={setDraft}
          onContentSizeChange={(e) =>
            setReplyHeight(Math.min(180, Math.max(84, e.nativeEvent.contentSize.height + 20)))
          }
          style={[
            s.text,
            {
              height: replyHeight,
              textAlignVertical: 'top',
              padding: 12,
              borderWidth: 1,
              borderColor: '#42606b',
              borderRadius: 10,
              backgroundColor: '#001016',
            },
          ]}
        />
      )}
      <View
        style={[
          s.composer,
          replyTo && {
            padding: 0,
            paddingTop: 10,
            flexWrap: 'wrap',
            borderTopWidth: 0,
            backgroundColor: 'transparent',
          },
        ]}
      >
        {!replyTo && (
          <View style={s.avatar}>
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            ) : (
              <Text style={s.text}>
                {(user?.displayName ?? 'Guest')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </Text>
            )}
          </View>
        )}
        <View
          style={[
            s.composerEntry,
            replyTo && { borderWidth: 0, backgroundColor: 'transparent', flexBasis: '100%' },
            (composerFocused || gifOpen || emojiOpen) && { borderColor: '#fff' },
          ]}
        >
          {selectedGif && (
            <View style={{ width: 44, height: 44, marginLeft: 4 }}>
              <Image
                source={{ uri: selectedGif.stillUrl }}
                style={{ width: 44, height: 44, borderRadius: 6 }}
                contentFit="contain"
                cachePolicy="none"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove GIF"
                onPress={() => setSelectedGif(null)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  backgroundColor: '#001016',
                  borderRadius: 10,
                }}
              >
                <Ionicons name="close" color="white" size={18} />
              </Pressable>
            </View>
          )}
          {!replyTo && (
            <TextInput
              ref={composerInput}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              accessibilityLabel="Say something"
              placeholder={selectedGif ? 'Add a message…' : 'Say something…'}
              placeholderTextColor="#a8bac4"
              value={draft}
              onChangeText={setDraft}
              maxLength={1000}
              style={[
                s.input,
                {
                  flex: 1,
                  borderWidth: 0,
                  padding: 10,
                  width: 0,
                  backgroundColor: 'transparent',
                },
              ]}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add GIF"
            onPress={() => {
              setEmojiOpen(false);
              setGifOpen(true);
            }}
            style={{ padding: 4 }}
          >
            <Text
              style={{
                color: '#b9cbd5',
                borderWidth: 1,
                borderColor: '#8aa6b4',
                borderRadius: 4,
                paddingHorizontal: 4,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              GIF
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add image"
            style={s.icon}
            onPress={() => void pickImage()}
          >
            <Ionicons name="image-outline" size={22} color="#b9cbd5" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose emoji"
            style={s.icon}
            onPress={() => setEmojiOpen(!emojiOpen)}
          >
            <Ionicons name="happy-outline" size={22} color="#b9cbd5" />
          </Pressable>
        </View>
        {replyTo && <Text style={[s.small, { marginRight: 'auto' }]}>{draft.length}/1000</Text>}
        {replyTo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            onPress={() => setReplyTo(undefined)}
            style={({ pressed }) => ({
              height: 48,
              width: 80,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#52727b',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? '#254b55' : 'transparent',
            })}
          >
            <Text style={s.text}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={replyTo ? 'Send reply' : 'Send message'}
          disabled={busy || (!draft.trim() && !attachment && !selectedGif)}
          style={[
            s.send,
            { backgroundColor: theme.primaryCTA },
            replyTo && { width: 80, borderRadius: 8 },
          ]}
          onPress={async () => {
            if (attachment) {
              Alert.alert(
                'Concept preview',
                'Image uploads are still preview-only. Remove the image to send text or a GIF.',
              );
              return;
            }
            if (
              await act({
                action: 'message',
                body: draft,
                clientId: Crypto.randomUUID(),
                name: user?.displayName ?? 'You',
                avatar: user?.avatarUrl,
                replyTo,
                ...(selectedGif
                  ? { media: toGifReference(selectedGif), resolvedGif: selectedGif }
                  : {}),
              })
            ) {
              if (selectedGif) void gifProvider.share(selectedGif.id, gifQuery).catch(() => {});
              setDraft('');
              setSelectedGif(null);
              setReplyTo(undefined);
              setNotice('Posted in this preview only. Nothing was saved to a server.');
            }
          }}
        >
          {replyTo ? (
            <Text style={s.text}>{busy ? 'Sending…' : 'Reply'}</Text>
          ) : (
            <Ionicons name="send" size={22} color={theme.onPrimary} />
          )}
        </Pressable>
      </View>
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {!daily && (
        <>
          <View style={s.header}>
            <Image source={teamLogoAssets[team]} style={s.logo} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>THE HUDDLE</Text>
              <Text style={s.small}>REAL FANS. REAL CONVERSATION.</Text>
            </View>
          </View>
        </>
      )}
      {!!error && (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.text}>
            {error}
          </Text>
          {button('Reconnect', () => void load())}
        </View>
      )}
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        onScrollBeginDrag={() => setGifPlaybackVersion((n) => n + 1)}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          atLive.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
        }}
        scrollEventThrottle={100}
      >
        {archive && (
          <Text style={[s.small, { padding: 10 }]}>
            The Huddle › Previous Huddles{daily ? ` › ${dailyDate(daily.date, true)}` : ''}
          </Text>
        )}
        {archive && !daily && (
          <Text style={s.text}>{data?.unavailable ?? 'Archived Huddles are not available.'}</Text>
        )}
        {daily && (
          <DailyHero
            daily={daily}
            onJoin={() => {
              setTab('Live');
              composerInput.current?.focus();
            }}
          />
        )}
        {!data && !error && <Text style={s.text}>Opening your team’s Huddle…</Text>}
        {data?.gameError && <Text style={s.muted}>{data.gameError}</Text>}
        {game && (
          <View style={[s.card, { borderWidth: 0 }]}>
            <View style={s.score}>
              <View style={s.scoreTeam}>
                <Image
                  source={teamLogoAssets[game.away]}
                  style={s.scoreLogo}
                  contentFit="contain"
                />
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.scoreNumber}>{game.awayScore ?? '—'}</Text>
                  <Text style={s.text}>{game.away}</Text>
                  <Text style={s.small}>({game.awayRecord ?? '—'})</Text>
                </View>
              </View>
              <View style={s.clock}>
                <Text
                  style={[
                    s.title,
                    { fontSize: 26, fontFamily: 'BarlowCondensed', color: theme.accent },
                  ]}
                >
                  {game.status === 'live'
                    ? `Q${game.quarter} ${game.clock}`
                    : game.status.toUpperCase()}
                </Text>
                <Text style={s.text}>{game.down}</Text>
                <Text style={s.text}>{game.location}</Text>
              </View>
              <View style={s.scoreTeam}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.scoreNumber}>{game.homeScore ?? '—'}</Text>
                  <Text style={s.text}>{game.home}</Text>
                  <Text style={s.small}>({game.homeRecord ?? '—'})</Text>
                </View>
                <Image
                  source={teamLogoAssets[game.home]}
                  style={s.scoreLogo}
                  contentFit="contain"
                />
              </View>
            </View>
            {game.status === 'pregame' && (
              <Text style={s.text}>{new Date(game.kickoff).toLocaleString()}</Text>
            )}
            <View style={s.scoreDetails}>
              <Text style={[s.text, { flex: 1, color: theme.accent }]}>
                ● {data?.participants?.toLocaleString() ?? '—'} IN THE HUDDLE
              </Text>
              <View style={s.driveOverview}>
                <Text style={s.small}>
                  LAST PLAY · {latest ? `Q${latest.quarter} ${latest.clock}` : '—'}
                </Text>
                <Text style={s.author}>{latest?.text ?? 'Waiting for the first play.'}</Text>
              </View>
            </View>
            {view === 'Live' && (
              <>
                <HuddleField game={game} />
              </>
            )}
          </View>
        )}
        <View style={s.tabs}>
          {(game
            ? ['Live', 'Chat', 'Polls', 'Play-by-Play']
            : daily
              ? ['Live', 'Chat', 'Polls']
              : ['Chat', 'Polls']
          ).map((t) =>
            button(
              archived ? (t === 'Live' ? 'All Activity' : t === 'Chat' ? 'Comments' : t) : t,
              () => setTab(t),
              t === view,
            ),
          )}
        </View>
        {!game && !daily && data && (
          <View style={s.card}>
            <Text style={s.subtitle}>
              {params.discussion ? 'Team discussion' : 'Your team. Your conversation.'}
            </Text>
            <Text style={s.muted}>
              Talk news, roster moves, film and everything {team}. No live game is available.
            </Text>
          </View>
        )}
        {view === 'Play-by-Play' ? (
          <>
            <ScrollView horizontal>
              {(['All Plays', 'Current Drive', 'Scoring', 'Key Plays'] as PlayFilter[]).map((f) =>
                button(f, () => setFilter(f), filter === f),
              )}
            </ScrollView>
            {filter === 'Current Drive' && (
              <Text style={s.muted}>{game?.driveSummary ?? 'Drive details unavailable.'}</Text>
            )}
            {!plays.length && <Text style={s.muted}>No plays available for this view.</Text>}
            {plays.map((p, i) => (
              <View key={p.id}>
                {(i === 0 || plays[i - 1].quarter !== p.quarter) && (
                  <Text style={s.quarter}>QUARTER {p.quarter}</Text>
                )}
                <View style={s.play}>
                  <View style={{ width: 60 }}>
                    <Text style={s.text}>{p.clock}</Text>
                    <Text style={s.small}>{p.down}</Text>
                    <Text style={s.small}>{p.location}</Text>
                  </View>
                  <Text style={[s.text, { flex: 1 }]}>{p.text}</Text>
                  <Text style={{ color: p.yards !== null && p.yards < 0 ? '#ff7a89' : '#54d69c' }}>
                    {p.scoring
                      ? 'SCORE'
                      : p.yards === null
                        ? '—'
                        : p.yards > 0
                          ? `+${p.yards}`
                          : p.yards}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : view === 'Polls' ? (
          <>
            {!data?.polls.length && (
              <Text style={s.muted}>No polls yet. Check back during the conversation.</Text>
            )}
            {daily
              ? data?.polls.map((p) =>
                  archived ? (
                    <ArchivePoll key={p.id} poll={p} team={team} inline />
                  ) : (
                    <DailyPoll
                      key={p.id}
                      poll={p}
                      team={team}
                      choice={data?.voted[p.id]}
                      onVote={(i) => void act({ action: 'vote', id: p.id, choice: i })}
                    />
                  ),
                )
              : data?.polls.map((p) => (
                  <View style={s.card} key={p.id}>
                    <Text style={s.subtitle}>{p.question}</Text>
                    {p.options.map((o, i) => (
                      <Pressable
                        key={i}
                        accessibilityRole="button"
                        disabled={busy || p.closed || data.voted[p.id] !== undefined}
                        style={s.pill}
                        onPress={() => void perform({ action: 'vote', id: p.id, choice: i })}
                      >
                        <Text style={s.text}>
                          {data.voted[p.id] === i ? '✓ ' : ''}
                          {o} · {p.counts[i] ?? 0}
                        </Text>
                      </Pressable>
                    ))}
                    {p.closed && <Text style={s.small}>Poll closed</Text>}
                  </View>
                ))}
          </>
        ) : (
          <>
            {playContext && button('Show all conversation', () => setPlayContext(null))}
            {data?.before && button('Load earlier messages', () => void load(data.before!))}
            {!data?.messages.some((m) => !m.removed && !data?.hiddenUsers.includes(m.userId)) && (
              <Text style={s.muted}>Start the conversation. What’s on your mind?</Text>
            )}
            {(daily ? dailyEntries(data?.messages ?? [], view, archived) : data?.messages)
              ?.filter(
                (m) =>
                  !m.removed &&
                  !data?.hiddenUsers.includes(m.userId) &&
                  (!playContext || m.playId === playContext),
              )
              .map((m) =>
                daily && m.kind === 'update' ? (
                  <DailyUpdate key={m.id} entry={m} accent={theme.primaryCTA} archived={archived} />
                ) : daily && m.kind === 'poll' ? (
                  (() => {
                    const poll = data?.polls.find((p) => p.id === m.pollId);
                    return poll ? (
                      archived ? (
                        <View style={s.card} key={m.id}>
                          <ArchivePoll poll={poll} team={team} inline />
                        </View>
                      ) : (
                        <DailyPoll
                          key={m.id}
                          poll={poll}
                          team={team}
                          choice={data?.voted[poll.id]}
                          onVote={(i) => void act({ action: 'vote', id: poll.id, choice: i })}
                        />
                      )
                    ) : null;
                  })()
                ) : (
                  <Fragment key={m.id}>
                    <View style={s.message} key={m.id}>
                      <View style={s.avatar}>
                        <Text style={s.text}>{m.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View
                        style={[
                          { flex: 1 },
                          daily && { backgroundColor: 'transparent', padding: 0 },
                        ]}
                      >
                        <Text style={s.author}>
                          {m.name}{' '}
                          <Text style={s.small}>
                            {archived
                              ? new Date(m.at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  timeZone: 'America/Chicago',
                                })
                              : daily?.fixture && m.userId !== 'preview-self'
                                ? `${Math.round((Date.parse('2026-09-30T16:44:00Z') - Date.parse(m.at)) / 60000)}m ago`
                                : simulator
                                  ? 'Fixture comment'
                                  : relativeTime(m.at)}
                          </Text>
                        </Text>
                        <Text style={s.text}>
                          {m.body}{' '}
                          {!archived && (
                            <Text
                              accessibilityRole="button"
                              accessibilityLabel={`Reply to ${m.name}`}
                              onPress={() => {
                                setReplyTo(m.id);
                              }}
                              style={{ color: '#a8bac4' }}
                            >
                              {' '}
                              <Ionicons name="arrow-undo-outline" size={15} color="#a8bac4" /> Reply
                            </Text>
                          )}
                        </Text>
                        {m.replyTo && (
                          <Text style={s.small}>
                            Replying to{' '}
                            {data?.messages.find((x) => x.id === m.replyTo)?.name ?? 'a message'}
                          </Text>
                        )}
                        {m.media && (
                          <PostedGif
                            media={m.media}
                            resolved={m.resolvedGif}
                            pauseVersion={gifPlaybackVersion}
                          />
                        )}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={archived}
                        accessibilityLabel={`Like message from ${m.name}`}
                        accessibilityState={{ selected: data?.liked.includes(m.id) }}
                        style={s.icon}
                        onPress={() =>
                          void perform({
                            action: 'like',
                            id: m.id,
                            enabled: !data?.liked.includes(m.id),
                          })
                        }
                      >
                        <Ionicons
                          name={data?.liked.includes(m.id) ? 'thumbs-up' : 'thumbs-up-outline'}
                          size={18}
                          color={data?.liked.includes(m.id) ? '#54d69c' : '#ffffff'}
                        />
                        <Text
                          style={[
                            s.small,
                            { color: data?.liked.includes(m.id) ? '#54d69c' : '#ffffff' },
                          ]}
                        >
                          {m.likes}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Options for message from ${m.name}`}
                        accessibilityRole="button"
                        style={s.icon}
                        onPress={() => setOptions(m)}
                      >
                        <Ionicons name="ellipsis-horizontal" color="white" size={18} />
                      </Pressable>
                    </View>
                    {!archived && replyTo === m.id && renderComposer()}
                  </Fragment>
                ),
              )}
          </>
        )}
        {daily &&
          (archived ? (
            <ArchiveCommunity daily={daily} polls={data?.polls ?? []} />
          ) : (
            <DailyCommunity
              daily={daily}
              polls={data?.polls ?? []}
              onPoll={() => {
                setTab('Polls');
                scroll.current?.scrollTo({ y: 0, animated: true });
              }}
            />
          ))}
        {options && (
          <View style={s.card}>
            <Text style={s.subtitle}>Message options</Text>
            <TextInput
              accessibilityLabel="Report reason"
              placeholder="Reason for report"
              placeholderTextColor="#a8bac4"
              value={report}
              onChangeText={setReport}
              style={s.input}
            />
            {button(
              'Report',
              () => void perform({ action: 'report', id: options.id, reason: report }),
            )}
            {button('Mute', () => void perform({ action: 'mute', userId: options.userId }))}
            {button('Block', () => void perform({ action: 'block', userId: options.userId }))}
            {data?.canModerate &&
              button('Remove message', () => void perform({ action: 'remove', id: options.id }))}
            {button('Close', () => setOptions(null))}
          </View>
        )}
        {!!data?.hiddenUsers.length && (
          <View style={s.card}>
            <Text style={s.subtitle}>Muted / blocked users</Text>
            {data.hiddenUsers.map((id) =>
              button(
                `Unhide ${id.slice(0, 8)}`,
                () => void perform({ action: 'unhide', userId: id }),
              ),
            )}
          </View>
        )}
        {!!notice && (
          <Text accessibilityRole="alert" style={s.small}>
            {notice}
          </Text>
        )}
        <Text style={[s.small, { padding: 12 }]}>
          {daily?.fixture
            ? 'DAILY HUDDLE PREVIEW · Sample conversation and metrics. Posts stay in this preview; nothing is uploaded.'
            : simulator
              ? 'DEVELOPMENT SIMULATOR · Fictional PHI vs DAL game. No live data.'
              : 'THE HUDDLE · Concept only. Live data is disabled.'}
        </Text>
        {simulator && (
          <View style={{ padding: 8, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                ['← PREVIOUS PLAY', simulator.previous, simulator.step === 0],
                ['NEXT PLAY →', simulator.next, simulator.step === 9],
                ['RESET GAME', simulator.reset, false],
              ].map(([label, action, disabled]) => (
                <Pressable
                  key={String(label)}
                  accessibilityRole="button"
                  accessibilityLabel={String(label)}
                  disabled={Boolean(disabled)}
                  onPress={action as () => void}
                  style={{
                    padding: 8,
                    minHeight: 44,
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#294c58',
                    borderRadius: 8,
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10 }}>{String(label)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.small}>
              Play {simulator.step + 1} / 10 · Resulting state · {game?.location} · Position{' '}
              {game?.ball} · {game?.down} →
            </Text>
          </View>
        )}
      </ScrollView>
      {!!(updates.messages || updates.plays) &&
        button(
          `↓ ${updates.plays ? `${updates.plays} NEW PLAYS · ` : ''}${updates.messages} NEW COMMENTS`,
          () => {
            scroll.current?.scrollToEnd({ animated: false });
            atLive.current = true;
            setUpdates({ plays: 0, messages: 0 });
          },
          true,
        )}
      {!archived && (view === 'Live' || view === 'Chat') && !replyTo && renderComposer()}
      {!archived && gifOpen && (
        <GifPicker
          accent={theme.primaryCTA}
          onClose={() => setGifOpen(false)}
          onSelect={(gif, q) => {
            setSelectedGif(gif);
            setGifQuery(q);
            setAttachment(null);
            setGifOpen(false);
            (replyTo ? replyInput.current : composerInput.current)?.focus();
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  inlineReply: {
    marginLeft: 20,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 2,
    borderColor: '#33505c',
    borderRadius: 10,
    backgroundColor: '#041920',
  },
  page: { flex: 1, backgroundColor: '#001016' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  logo: { width: 48, height: 48 },
  title: { fontFamily: 'BarlowCondensedItalic', fontSize: 36, color: 'white' },
  subtitle: { fontFamily: 'BarlowCondensed', fontSize: 20, color: 'white', marginBottom: 8 },
  text: { fontFamily: 'BarlowCondensedRegular', fontSize: 16, lineHeight: 20, color: '#f4f8fa' },
  muted: {
    fontFamily: 'BarlowCondensedRegular',
    color: '#a8bac4',
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 12,
  },
  small: { fontFamily: 'BarlowCondensedRegular', color: '#a8bac4', fontSize: 13, lineHeight: 17 },
  tabs: { flexDirection: 'row', paddingHorizontal: 0, gap: 4 },
  pill: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#294750',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'center',
    margin: 3,
  },
  card: {
    borderWidth: 1,
    borderColor: '#294750',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#031820',
  },
  score: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    minHeight: 100,
  },
  scoreNumber: { fontFamily: 'BarlowCondensed', fontSize: 48, color: 'white' },
  clock: { alignItems: 'center' },
  scoreTeam: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scoreLogo: { width: 38, height: 38 },
  scoreDetails: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  driveOverview: { padding: 8, borderWidth: 1, borderColor: '#294c58', borderRadius: 8 },
  composerEntry: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#42606b',
    borderRadius: 24,
    backgroundColor: '#041920',
  },
  emojiTray: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, backgroundColor: '#092831' },
  quarter: {
    backgroundColor: '#0e252e',
    padding: 10,
    color: '#b7cbd5',
    fontFamily: 'BarlowCondensedSemiBold',
    fontSize: 16,
  },
  play: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#15353e',
  },
  message: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: '#031820',
    borderRadius: 7,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#315663',
    alignItems: 'center',
    justifyContent: 'center',
  },
  author: { color: 'white', fontFamily: 'BarlowCondensedSemiBold', fontSize: 14, marginBottom: 4 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  composer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#294750',
  },
  input: {
    fontFamily: 'BarlowCondensedRegular',
    fontSize: 16,
    backgroundColor: '#061a22',
    borderWidth: 1,
    borderColor: '#3e5a65',
    borderRadius: 14,
    color: 'white',
    padding: 14,
    minHeight: 48,
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
