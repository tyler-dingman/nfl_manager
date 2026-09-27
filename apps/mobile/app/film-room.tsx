import { PageScrollView as ScrollView } from '../components/page-scroll-view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Eyebrow, Heading } from '../components/screen';
import { MobileFilterBar } from '../components/mobile-filter-bar';
import { filterValue } from '../../../packages/filters';
import {
  FILM_ROOM_FILTERS,
  FILM_ROOM_CATEGORIES,
  filterFilmVideos,
  filmPublishedLabel,
} from '../../../packages/filters/film-room';
import { getFilmRoom, type MobileFilmVideo } from '../lib/api';
import CrewShareModal, { type MobileCrewShareContent } from '../components/crew-share-modal';
import { useTeam } from '../lib/team-context';

export default function FilmRoomScreen() {
  const { teamId } = useTeam();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; order?: string }>();
  const category = filterValue(FILM_ROOM_FILTERS[0], { category: params.category ?? 'all' });
  const order = filterValue(FILM_ROOM_FILTERS[1], { order: params.order ?? 'newest' });
  const [items, setItems] = useState<MobileFilmVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [shareContent, setShareContent] = useState<MobileCrewShareContent | null>(null);
  const request = useRef(0);
  const cancelRequests = useCallback(() => {
    request.current++;
  }, []);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setMessage('');
    try {
      const body = await getFilmRoom(teamId);
      if (id !== request.current) return;
      setItems(body.videos);
      setMessage(body.message ?? '');
    } catch (e) {
      if (id === request.current)
        setMessage(e instanceof Error ? e.message : 'Film Room is unavailable.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [teamId]);
  useEffect(() => {
    setItems([]);
    void load();
    return cancelRequests;
  }, [load, cancelRequests]);
  const videos = useMemo(() => filterFilmVideos(items, category, order), [items, category, order]);
  const open = (url: string) => {
    void Linking.openURL(url).catch(() =>
      setMessage('Unable to open this video. Please try again.'),
    );
  };
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={[
        s.body,
        {
          paddingBottom: Math.max(24, insets.bottom),
          paddingLeft: Math.max(12, insets.left),
          paddingRight: Math.max(12, insets.right),
        },
      ]}
      stickyHeaderIndices={[1]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View>
        <Eyebrow>{teamId} · FILM ROOM</Eyebrow>
        <Heading>Get into the tape.</Heading>
        <Text style={s.intro}>Verified team video, analysis, and creator coverage.</Text>
      </View>
      <MobileFilterBar
        primary={FILM_ROOM_FILTERS}
        secondary={[]}
        values={{ category, order }}
        onChange={(changes) => router.setParams(changes)}
      />
      <Text accessibilityLiveRegion="polite" style={s.count}>
        {loading
          ? 'LOADING VIDEOS…'
          : `${videos.length} ${videos.length === 1 ? 'VIDEO' : 'VIDEOS'} · TRENDING NOW`}
      </Text>
      {message ? <Text style={s.message}>{message}</Text> : null}
      {!loading && !videos.length && (
        <Text style={s.message}>No videos match this category. Try All.</Text>
      )}
      {videos.map((video, index) => (
        <View key={video.id} style={s.card}>
          <View style={index === 0 ? undefined : s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${video.title}`}
              onPress={() => open(video.youtubeUrl)}
              style={[s.thumbnail, index > 0 && s.smallThumbnail]}
            >
              <Image source={{ uri: video.thumbnail }} style={s.image} />
              {index === 0 && <Text style={s.badge}>#1 TRENDING</Text>}
              <View style={[s.play, index === 0 && s.largePlay]}>
                <Feather name="play" size={index === 0 ? 22 : 14} color="white" />
              </View>
              {!!video.duration && <Text style={s.duration}>{video.duration}</Text>}
            </Pressable>
            <View style={[s.copy, index === 0 && s.featuredCopy]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${video.title}`}
                style={s.titleButton}
                onPress={() => open(video.youtubeUrl)}
              >
                <Text
                  numberOfLines={index === 0 ? 2 : 3}
                  style={[s.title, index === 0 && s.featuredTitle]}
                >
                  {video.title}
                </Text>
              </Pressable>
              <View style={s.channel}>
                {video.channel.avatar ? (
                  <Image source={{ uri: video.channel.avatar }} style={s.avatar} />
                ) : (
                  <View style={s.avatar}>
                    <Text style={s.meta}>{video.channel.name.slice(0, 1)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.source}>{video.channel.name}</Text>
                  {video.channel.subscriberCount != null && (
                    <Text style={s.meta}>
                      {Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(video.channel.subscriberCount)}{' '}
                      subscribers
                    </Text>
                  )}
                </View>
              </View>
              <Text style={s.meta}>
                {filmPublishedLabel(video.publishedAt)}
                {video.publishedAt ? ' · ' : ''}
                {FILM_ROOM_CATEGORIES.find((c) => c.id === video.category)?.label}
              </Text>
            </View>
          </View>
          <View style={s.actions}>
            <Pressable
              accessibilityRole="link"
              style={s.action}
              onPress={() => open(video.youtubeUrl)}
            >
              <Text style={s.actionText}>YouTube</Text>
              <Feather name="external-link" size={14} color={C.red} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.action}
              onPress={() =>
                setShareContent({
                  contentType: 'FILM_ROOM',
                  contentId: video.id,
                  href: `/watch?video=${video.id}`,
                  title: video.title,
                })
              }
            >
              <Feather name="share-2" size={14} color={C.red} />
              <Text style={s.actionText}>Share</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              style={s.action}
              onPress={() => open(video.channelUrl)}
            >
              <Text style={s.actionText}>Channel</Text>
              <Feather name="external-link" size={14} color={C.red} />
            </Pressable>
          </View>
        </View>
      ))}
      {shareContent && (
        <CrewShareModal
          visible
          content={shareContent}
          onClose={() => setShareContent(null)}
          onShared={setMessage}
        />
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6f8' },
  body: { paddingTop: 18 },
  intro: { color: C.muted, lineHeight: 21, marginTop: 10, marginBottom: 12 },
  count: { marginVertical: 8, fontSize: 12, fontWeight: '700', color: '#6d7f91' },
  message: { color: C.muted, marginBottom: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    minHeight: 44,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  smallThumbnail: { width: '38%', borderRadius: 6 },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00172be6',
    color: 'white',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '900',
  },
  duration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#000c',
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  play: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -14 }, { translateY: -14 }],
    width: 28,
    height: 28,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'white',
    backgroundColor: '#0008',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largePlay: { width: 44, height: 44, transform: [{ translateX: -22 }, { translateY: -22 }] },
  copy: { flex: 1, minWidth: 0 },
  featuredCopy: { flex: 0, paddingTop: 12, paddingHorizontal: 12 },
  titleButton: { minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#00172b' },
  featuredTitle: { fontSize: 18, lineHeight: 23 },
  source: { fontSize: 12, fontWeight: '700', color: '#40556b', marginTop: 4 },
  meta: { fontSize: 11, lineHeight: 15, color: '#637381', marginTop: 3 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', marginHorizontal: 8, marginTop: 4 },
  action: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: C.red },
});
