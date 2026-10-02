import { FilmRoomCardActions } from './film-room-card-actions';
import { normalizeDisplayHeadline } from '../../../src/lib/display-headline';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getFilmRoom, type MobileFilmVideo } from '../lib/api';
import { useTeam } from '../lib/team-context';
import { VideoPlayOverlay } from './video-play-overlay';
import CrewShareModal from './crew-share-modal';
export function HomeFilmRoom() {
  const { teamId } = useTeam();
  const [videos, setVideos] = useState<MobileFilmVideo[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [share, setShare] = useState<MobileFilmVideo | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setVideos([]);
    void getFilmRoom(teamId)
      .then((data) => {
        if (active) setVideos(data.videos.slice(0, 3));
      })
      .catch(() => {
        if (active) setError('Film Room could not be loaded. Tap to retry.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId, retry]);
  const open = (url: string) =>
    void Linking.openURL(url).catch(() => setError('Unable to open this link.'));
  return (
    <View testID="home-film-room" style={s.section}>
      <Text style={s.label}>FILM ROOM</Text>
      <View style={s.heading}>
        <Text style={s.headingText}>Worth your time today</Text>
        <Pressable onPress={() => router.push('/film-room')}>
          <Text style={s.browse}>Browse all →</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator color="white" />}
      {!!error && (
        <Pressable onPress={() => setRetry((n) => n + 1)}>
          <Text style={s.message}>{error}</Text>
        </Pressable>
      )}
      {!loading && !error && !videos.length && (
        <Text style={s.message}>No Film Room videos are available for this team yet.</Text>
      )}
      {videos.map((video, i) => (
        <View key={video.id} style={s.card}>
          <View style={i === 0 ? undefined : s.compact}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Watch ${normalizeDisplayHeadline(video.title)}`}
              onPress={() => open(video.youtubeUrl)}
              style={[s.thumbnail, i > 0 && { width: '38%' }]}
            >
              <Image
                source={{ uri: video.thumbnail }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <VideoPlayOverlay />
              {i === 0 && <Text style={s.badge}>#1 TRENDING</Text>}
              <Text style={s.duration}>{video.duration}</Text>
            </Pressable>
            <View style={[s.copy, i > 0 && { flex: 1, padding: 0 }]}>
              <Pressable onPress={() => open(video.youtubeUrl)}>
                <Text style={[s.title, i > 0 && { fontSize: 14, lineHeight: 19 }]}>
                  {normalizeDisplayHeadline(video.title)}
                </Text>
              </Pressable>
              <View style={s.channel}>
                {video.channel.avatar ? (
                  <Image source={{ uri: video.channel.avatar }} style={s.avatar} />
                ) : (
                  <View style={s.avatar}>
                    <Text>{video.channel.name.slice(0, 1)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.source}>{video.channel.name}</Text>
                  {video.channel.subscriberCount != null && (
                    <Text style={s.meta}>
                      {Intl.NumberFormat('en', { notation: 'compact' }).format(
                        video.channel.subscriberCount,
                      )}{' '}
                      subscribers
                    </Text>
                  )}
                </View>
              </View>
              <Text style={s.meta}>
                {video.publishedAt
                  ? new Date(video.publishedAt).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                    }) + ' · '
                  : ''}
                {video.category.replaceAll('_', ' ')}
              </Text>
            </View>
          </View>
          <FilmRoomCardActions
            onYoutube={() => open(video.youtubeUrl)}
            onChannel={() => open(video.channelUrl)}
            onShare={() => setShare(video)}
          />
        </View>
      ))}
      {share && (
        <CrewShareModal
          visible
          content={{
            contentId: share.id,
            contentType: 'FILM_ROOM',
            href: `/watch?video=${share.id}`,
            title: share.title,
          }}
          onClose={() => setShare(null)}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: { marginTop: 40, backgroundColor: '#020617', borderRadius: 24, padding: 24 },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 2.8, color: 'white' },
  heading: { marginTop: 8, marginBottom: 24, gap: 8 },
  headingText: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: 'white' },
  browse: { color: '#FFFFFF99', fontSize: 14, fontWeight: '700' },
  message: { color: '#CBD5E1', paddingVertical: 16 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: 'white',
    marginBottom: 16,
  },
  compact: { flexDirection: 'row', gap: 10, padding: 10 },
  thumbnail: { aspectRatio: 16 / 9, backgroundColor: '#020617', overflow: 'hidden' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00172BE6',
    color: 'white',
    padding: 5,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '900',
  },
  duration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    color: 'white',
    backgroundColor: '#000C',
    padding: 3,
    fontSize: 10,
    fontWeight: '800',
  },
  copy: { padding: 12 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#00172B' },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  source: { fontSize: 12, fontWeight: '700', color: '#40556B' },
  meta: { fontSize: 11, lineHeight: 16, color: '#64748B', marginTop: 4 },

});
