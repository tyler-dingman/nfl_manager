import { FranchiseNewsFeed } from './franchise-news-feed';
import { isFrontOfficeNewsNotification } from '../../../src/lib/front-office-news-notifications';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FrontOfficeEvent } from '../../../src/types/front-office';
import {
  eventToLeagueNewsStory,
  frontOfficeEventIncludesTeam,
  relativeNewsTime,
  type LeagueNewsStory,
} from '../../../src/lib/front-office-league-news';
import { frontOfficeMessages } from '../../../packages/front-office/messages';
import { franchiseRequest } from './franchise-roster';
import { useTeamBranding } from '../lib/team-branding';
import { API_BASE_URL } from '../lib/network';
import { SectionMenu } from './section-menu';
const categories = [
  'ALL',
  'RUMOR',
  'INJURY',
  'TRANSACTION',
  'CONTRACT',
  'GAME_RECAP',
  'ANALYSIS',
  'MY_TEAM',
];
function LegacyFranchiseNews({
  saveId,
  messages = false,
  notificationsOnly = false,
}: {
  saveId: string;
  messages?: boolean;
  notificationsOnly?: boolean;
}) {
  const { teamId, theme } = useTeamBranding();
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
    setEvents([]);
    setSelected(null);
  }, [saveId]);
  const [category, setCategory] = useState('ALL'),
    [sort, setSort] = useState('Recent'),
    [selected, setSelected] = useState<LeagueNewsStory | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void franchiseRequest<{ events: FrontOfficeEvent[]; nextOffset: number | null }>(
      `/api/front-office/events?saveId=${encodeURIComponent(saveId)}&offset=${page}&notifications=${notificationsOnly ? 1 : 0}`,
    )
      .then((body) => {
        if (!Array.isArray(body.events)) throw new Error('News data is incomplete.');
        if (active) {
          setEvents((current) =>
            page
              ? [...new Map([...current, ...body.events].map((e) => [e.id, e])).values()]
              : body.events,
          );
          setNextOffset(body.nextOffset);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load updates.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [saveId, retry, page, notificationsOnly]);
  const stories = useMemo(
    () =>
      events
        .filter((event) => !notificationsOnly || isFrontOfficeNewsNotification(event))
        .filter(
          (e) => !e.dismissedAt && e.type !== 'welcome_message' && e.metadata.channel !== 'MESSAGE',
        )
        .map((e) => eventToLeagueNewsStory(e, teamId))
        .filter(
          (story) =>
            category === 'ALL' ||
            (category === 'MY_TEAM'
              ? frontOfficeEventIncludesTeam(story.event, teamId)
              : story.category === category),
        )
        .sort((a, b) =>
          sort === 'Trending'
            ? b.trendingScore - a.trendingScore
            : sort === 'Relevant'
              ? b.importanceScore - a.importanceScore
              : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        ),
    [events, category, sort, teamId, notificationsOnly],
  );
  return (
    <View>
      <Text style={s.heading}>{messages ? 'MESSAGES' : 'LEAGUE NEWS'}</Text>
      <Text style={s.copy}>
        {messages
          ? 'Review updates from your coaches, players, and football operations staff.'
          : 'Follow the latest moves, injuries, rumors, and storylines from around your league.'}
      </Text>
      {loading && <ActivityIndicator color="white" />}
      {!!error && (
        <Pressable style={s.card} onPress={() => setRetry((v) => v + 1)}>
          <Text accessibilityRole="alert" style={s.copy}>
            {error}
          </Text>
          <Text style={s.title}>Try again →</Text>
        </Pressable>
      )}
      {messages ? (
        frontOfficeMessages(events).map((event) => (
          <View key={event.id} style={[s.card, s.row]}>
            {typeof event.metadata.headshotUrl === 'string' ? (
              <Image source={{ uri: event.metadata.headshotUrl }} style={s.avatar} />
            ) : (
              <View
                style={[
                  s.avatar,
                  {
                    backgroundColor: theme.primaryFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>
                  {String(event.metadata.senderName ?? event.headline).slice(0, 1)}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{event.headline}</Text>
              <Text style={s.meta}>{String(event.metadata.senderRole ?? 'Front Office')}</Text>
              <Text style={s.copy}>{event.summary}</Text>
            </View>
          </View>
        ))
      ) : (
        <>
          <SectionMenu
            title={`Category: ${category.replaceAll('_', ' ')}`}
            items={categories.map((value) => ({
              label: value.replaceAll('_', ' '),
              selected: category === value,
              onPress: () => setCategory(value),
            }))}
          />
          <SectionMenu
            title={`Sort: ${sort}`}
            items={['Recent', 'Trending', 'Relevant'].map((value) => ({
              label: value,
              selected: sort === value,
              onPress: () => setSort(value),
            }))}
          />
          {stories.map((story, index) => (
            <Pressable key={story.id} style={s.card} onPress={() => setSelected(story)}>
              <Graphic story={story} featured={index === 0} />
              <Text style={s.meta}>
                {story.categoryLabel} · {relativeNewsTime(story.publishedAt)}
              </Text>
              <Text style={s.copy}>{story.summary}</Text>
              <Text style={s.title}>Read full story →</Text>
            </Pressable>
          ))}
        </>
      )}
      {!loading && !error && (messages ? !frontOfficeMessages(events).length : !stories.length) && (
        <Text style={s.copy}>
          {messages
            ? 'No messages yet.'
            : 'No stories match this view yet. Advance the season to generate the next news cycle.'}
        </Text>
      )}
      {nextOffset !== null && !loading && (
        <Pressable accessibilityRole="button" onPress={() => setPage(nextOffset)}>
          <Text style={s.copy}>Load older updates</Text>
        </Pressable>
      )}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.modal}>
          <Pressable
            style={s.close}
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            accessibilityLabel="Close league story"
          >
            <Text style={s.title}>← Back to League News</Text>
          </Pressable>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {selected && (
              <>
                <Graphic story={selected} featured />
                <View style={s.article}>
                  <Text style={s.articleTitle}>{selected.headline}</Text>
                  <Text style={s.articleCopy}>{relativeNewsTime(selected.publishedAt)}</Text>
                  <Text style={s.articleCopy}>{selected.summary}</Text>
                  <Text style={s.articleTitle}>What happened</Text>
                  <Text style={s.articleCopy}>{selected.summary}</Text>
                  {typeof selected.event.metadata.sourceUrl === 'string' &&
                  /^https?:\/\//.test(selected.event.metadata.sourceUrl) ? (
                    <Pressable
                      style={s.close}
                      onPress={() =>
                        void Linking.openURL(String(selected.event.metadata.sourceUrl)).catch(() =>
                          setError('Unable to open source.'),
                        )
                      }
                    >
                      <Text style={s.articleTitle}>Read the source ↗</Text>
                    </Pressable>
                  ) : (
                    <Text style={s.articleCopy}>
                      This report comes from the events recorded in your Front Office season.
                    </Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
function Graphic({ story, featured }: { story: LeagueNewsStory; featured: boolean }) {
  return (
    <View
      style={[
        s.graphic,
        { borderColor: story.team?.primaryColor ?? '#E31837', minHeight: featured ? 210 : 145 },
      ]}
    >
      {story.team?.logoUrl && (
        <Image
          source={{
            uri: story.team.logoUrl.startsWith('http')
              ? story.team.logoUrl
              : `${API_BASE_URL}${story.team.logoUrl}`,
          }}
          style={s.logo}
        />
      )}
      <Text style={s.meta}>
        {story.isBreaking ? 'BREAKING NEWS' : story.categoryLabel.toUpperCase()}
      </Text>
      <Text style={[s.heading, { fontSize: featured ? 32 : 26 }]}>{story.headline}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  heading: {
    fontFamily: 'BarlowCondensed',
    fontSize: 32,
    lineHeight: 35,
    color: 'white',
    marginVertical: 12,
  },
  copy: { color: '#B4C6D1', fontSize: 14, lineHeight: 22, marginVertical: 10 },
  title: { color: 'white', fontWeight: '800', fontSize: 16 },
  meta: { color: '#9FBAC9', fontSize: 12, marginVertical: 8 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23414E',
    backgroundColor: '#061D2B',
    marginVertical: 10,
  },
  row: { flexDirection: 'row', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  graphic: {
    padding: 20,
    borderLeftWidth: 6,
    backgroundColor: '#001222',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  logo: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 90,
    height: 70,
    resizeMode: 'contain',
    opacity: 0.28,
  },
  modal: { flex: 1, backgroundColor: '#001222' },
  close: { minHeight: 48, padding: 16, justifyContent: 'center' },
  article: {
    backgroundColor: 'white',
    padding: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  articleTitle: { fontSize: 24, color: '#00172B', fontWeight: '800', marginVertical: 12 },
  articleCopy: { fontSize: 16, lineHeight: 26, color: '#52677A', marginVertical: 10 },
});

export function FranchiseNews(props: {
  saveId: string;
  messages?: boolean;
  notificationsOnly?: boolean;
}) {
  return props.messages ? (
    <LegacyFranchiseNews {...props} />
  ) : (
    <FranchiseNewsFeed saveId={props.saveId} preview={props.notificationsOnly} />
  );
}
