import { router } from 'expo-router';
import { nativeDestination } from '../lib/native-destination';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Crew, CrewActivity } from '../../../src/features/crew/types';
import { crewPostSchema } from '../../../src/features/crew/validation';
import { authenticatedFetch } from '../lib/auth';
import { useAuth } from '../lib/auth-context';
import { useTeamBranding } from '../lib/team-branding';
async function request(path: string, method = 'POST', body?: object | FormData) {
  const response = await authenticatedFetch(path, {
    method,
    ...(body instanceof FormData
      ? { body }
      : body
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Unable to update Crew.');
  return data;
}
export async function chooseCrewPhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });
  if (result.canceled) return null;
  const source = result.assets[0];
  const photo = await ImageManipulator.manipulateAsync(
    source.uri,
    source.width > 1280 || source.height > 1280
      ? [{ resize: source.width >= source.height ? { width: 1280 } : { height: 1280 } }]
      : [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(photo.uri).then((r) => r.blob());
    if (blob.size > 2 * 1024 * 1024) throw new Error('Choose a smaller photo.');
    form.append('photo', blob, 'crew-photo.jpg');
  } else
    form.append('photo', {
      uri: photo.uri,
      name: 'crew-photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  return request('/api/crew/media', 'POST', form) as Promise<{ id: string; url: string }>;
}
export function CrewPhoto({ url }: { url: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUri(null);
    if (!url.startsWith('/api/crew/media/')) return;
    void authenticatedFetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (active) setUri(String(reader.result));
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [url]);
  return uri ? (
    <Image source={{ uri }} style={s.photo} accessibilityLabel="Crew photo" />
  ) : (
    <Text style={s.copy}>Photo unavailable</Text>
  );
}
export function CrewFeed({ crew, onRefresh }: { crew: Crew; onRefresh: () => Promise<void> }) {
  const { user } = useAuth();
  const { theme } = useTeamBranding();
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function post() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const parsed = crewPostSchema.parse({
        kind: photo ? 'PHOTO' : link.trim() ? 'LINK' : 'TEXT',
        message,
        mediaId: photo?.id,
        href: link.trim() || undefined,
      });
      await request('/api/crew/posts', 'POST', parsed);
      setMessage('');
      setLink('');
      setPhoto(null);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to post.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <View style={s.card}>
        <Text style={s.title}>WHAT’S THE WORD?</Text>
        <TextInput
          accessibilityLabel="Crew post"
          placeholder="Share something with your Crew…"
          placeholderTextColor="#667784"
          multiline
          maxLength={4000}
          value={message}
          onChangeText={setMessage}
          style={s.input}
        />
        <TextInput
          accessibilityLabel="Link to share"
          placeholder="Add a link (optional)"
          placeholderTextColor="#667784"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          keyboardType="url"
          style={s.input}
        />
        {photo && (
          <>
            <CrewPhoto url={photo.url} />
            <Pressable style={s.touch} onPress={() => setPhoto(null)}>
              <Text>Remove photo</Text>
            </Pressable>
          </>
        )}
        <View style={s.row}>
          <Pressable
            disabled={busy}
            style={s.touch}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                const result = await chooseCrewPhoto();
                if (result) setPhoto(result);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to select photo.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={s.name}>＋ Photo</Text>
          </Pressable>
          <Pressable
            disabled={busy || (!message.trim() && !photo && !link.trim())}
            style={[s.button, { backgroundColor: theme.primaryFill }]}
            onPress={() => void post()}
          >
            <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>
              {busy ? 'SAVING…' : 'POST'}
            </Text>
          </Pressable>
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={s.copy}>
            {error}
          </Text>
        )}
      </View>
      {!crew.activity.length && (
        <View style={s.card}>
          <Text style={s.title}>Your crew starts here.</Text>
          <Text style={s.copy}>Shared stories and activity will appear in your feed.</Text>
        </View>
      )}
      {crew.activity.map((item) => (
        <Activity
          key={item.id}
          item={item}
          canDelete={crew.role === 'OWNER' || item.actorUserId === user?.id}
          onRefresh={onRefresh}
        />
      ))}
    </View>
  );
}
function Activity({
  item,
  canDelete,
  onRefresh,
}: {
  item: CrewActivity;
  canDelete: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function action(path: string, body?: object, method = 'POST') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      setComment('');
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update post.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.name}>{item.actorName ?? 'Crew member'}</Text>
      <Text style={s.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      {item.metadata.title && <Text style={s.title}>{item.metadata.title}</Text>}
      {item.message && <Text style={s.copy}>{item.message}</Text>}
      {item.metadata.photoUrl && <CrewPhoto url={item.metadata.photoUrl} />}
      {item.href && (nativeDestination(item.href) || /^https?:\/\//.test(item.href)) && (
        <Pressable
          style={s.touch}
          onPress={() => {
            const destination = nativeDestination(item.href);
            if (destination) router.push(destination);
            else void Linking.openURL(item.href!).catch(() => setError('Unable to open link.'));
          }}
        >
          <Text style={s.name}>Open shared link ↗</Text>
        </Pressable>
      )}
      <View style={s.row}>
        {[
          ['FIRE', '🔥'],
          ['LAUGH', '😂'],
          ['EYES', '👀'],
          ['LIKE', '👍'],
        ].map(([reaction, icon]) => (
          <Pressable
            key={reaction}
            disabled={busy}
            accessibilityLabel={`React ${reaction}`}
            accessibilityState={{
              selected: item.reactions?.some(
                (r) => r.reaction === reaction && r.userId === user?.id,
              ),
            }}
            style={s.touch}
            onPress={() => void action(`/api/crew/activity/${item.id}/reactions`, { reaction })}
          >
            <Text>
              {icon} {item.reactions?.filter((r) => r.reaction === reaction).length ?? 0}
            </Text>
          </Pressable>
        ))}
      </View>
      {item.comments?.map((c) => (
        <View key={c.id} style={s.comment}>
          <Text style={s.name}>{c.actorName ?? 'Crew member'}</Text>
          <Text style={s.copy}>{c.message}</Text>
        </View>
      ))}
      <TextInput
        accessibilityLabel="Comment on post"
        placeholder="Add a comment…"
        placeholderTextColor="#667784"
        value={comment}
        onChangeText={setComment}
        maxLength={2000}
        style={s.input}
      />
      <Pressable
        disabled={busy || !comment.trim()}
        style={s.touch}
        onPress={() =>
          void action(`/api/crew/activity/${item.id}/comments`, { message: comment.trim() })
        }
      >
        <Text style={s.name}>SEND COMMENT →</Text>
      </Pressable>
      {canDelete && (
        <Pressable
          disabled={busy}
          style={s.touch}
          onPress={() =>
            Alert.alert('Delete post?', 'This post will be removed from your Crew.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => void action(`/api/crew/activity/${item.id}`, undefined, 'DELETE'),
              },
            ])
          }
        >
          <Text style={s.copy}>Delete post</Text>
        </Pressable>
      )}
      {!!error && <Text style={s.copy}>{error}</Text>}
    </View>
  );
}
export function CrewSettings({ crew, onRefresh }: { crew: Crew; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState(crew.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function update(path: string, method: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update Crew.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>CREW SETTINGS</Text>
      {crew.role === 'OWNER' && (
        <>
          <TextInput
            accessibilityLabel="Crew name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            style={s.input}
          />
          <Pressable
            disabled={busy || name.trim().length < 2}
            style={s.touch}
            onPress={() => void update('/api/crew', 'PATCH', { name: name.trim() })}
          >
            <Text style={s.name}>Save crew name →</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            style={s.touch}
            onPress={async () => {
              setBusy(true);
              try {
                const photo = await chooseCrewPhoto();
                if (photo) {
                  await request('/api/crew', 'PATCH', { photoMediaId: photo.id });
                  await onRefresh();
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to update photo.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={s.name}>Change Crew photo →</Text>
          </Pressable>
          {crew.members
            .filter((m) => m.id !== crew.ownerUserId)
            .map((m) => (
              <Pressable
                key={m.id}
                disabled={busy}
                style={s.touch}
                onPress={() =>
                  Alert.alert('Remove member?', `Remove ${m.displayName} from the Crew?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => void update(`/api/crew/members/${m.id}`, 'DELETE'),
                    },
                  ])
                }
              >
                <Text style={s.copy}>Remove {m.displayName}</Text>
              </Pressable>
            ))}
        </>
      )}
      <Pressable
        disabled={busy}
        style={s.touch}
        onPress={() =>
          Alert.alert(
            'Leave Crew?',
            crew.role === 'OWNER'
              ? 'Leaving as owner may dissolve this Crew. Continue?'
              : 'You will leave this Crew.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () => void update('/api/crew', 'DELETE'),
              },
            ],
          )
        }
      >
        <Text style={s.name}>Leave Crew</Text>
      </Pressable>
      {!!error && (
        <Text accessibilityRole="alert" style={s.copy}>
          {error}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DAE1E6',
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
  },
  title: { fontFamily: 'BarlowCondensed', fontSize: 25, color: '#001222', marginVertical: 8 },
  name: { fontWeight: '800', fontSize: 14, color: '#001222' },
  copy: { fontSize: 14, lineHeight: 22, color: '#52616C', marginVertical: 8 },
  meta: { fontSize: 12, color: '#667784', marginTop: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#DAE1E6',
    borderRadius: 8,
    padding: 14,
    minHeight: 48,
    marginVertical: 8,
    color: '#001222',
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  touch: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 'auto',
  },
  photo: { width: '100%', height: 230, borderRadius: 12, resizeMode: 'cover', marginVertical: 12 },
  comment: { backgroundColor: '#F5F7F9', borderRadius: 8, padding: 12, marginVertical: 6 },
});
