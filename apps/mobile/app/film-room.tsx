import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { getFilmRoom, type MobileFilmVideo } from '../lib/api';
import CrewShareModal, { type MobileCrewShareContent } from '../components/crew-share-modal';
import { useTeam } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';
export default function FilmRoomScreen() {
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const [items, setItems] = useState<MobileFilmVideo[]>([]),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState('');
  const [shareContent, setShareContent] = useState<MobileCrewShareContent | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await getFilmRoom(teamId);
      setItems(body.videos);
      setMessage(body.message ?? '');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Film Room is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {' '}
      <Eyebrow>{teamId} · FILM ROOM</Eyebrow>
      <Heading>Get into the tape.</Heading>
      <Text style={s.intro}>Verified team video, analysis, and creator coverage.</Text>
      {message ? <Text style={s.message}>{message}</Text> : null}
      {items.map((video) => (
        <View key={video.id} style={s.card}>
          <Image source={{ uri: video.thumbnail }} style={s.image} />
          <View style={s.copy}>
            <Text style={[s.category, { color: theme.primary }]}>
              {video.category.replaceAll('-', ' ')}
            </Text>
            <Text style={s.title}>{video.title}</Text>
            <Text style={s.channel}>
              {video.channel.name} · {video.duration}
            </Text>
            <View style={s.actions}>
              <Pressable
                style={[s.primary, { backgroundColor: theme.primaryFill }]}
                onPress={() => void Linking.openURL(video.youtubeUrl)}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '900' }}>WATCH</Text>
              </Pressable>
              <Pressable
                style={s.share}
                onPress={() => {
                  setShareContent({
                    contentType: 'FILM_ROOM',
                    contentId: video.id,
                    href: `/watch?video=${video.id}`,
                    title: video.title,
                  });
                }}
              >
                <Text style={s.shareText}>SHARE WITH THE CREW</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
      {shareContent ? (
        <CrewShareModal
          visible
          content={shareContent}
          onClose={() => setShareContent(null)}
          onShared={setMessage}
        />
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  body: { padding: 18, paddingBottom: 40 },
  intro: { color: C.muted, lineHeight: 21, marginTop: 10, marginBottom: 18 },
  message: { color: C.muted, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: C.white, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  image: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#D8D8D8' },
  copy: { padding: 16 },
  category: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 19, fontWeight: '900', lineHeight: 23, color: C.ink, marginTop: 7 },
  channel: { fontSize: 13, color: C.muted, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  primary: {
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: {
    minHeight: 46,
    flex: 1,
    borderWidth: 1,
    borderColor: '#CFD4D7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { fontSize: 11, fontWeight: '900', color: C.ink },
});
