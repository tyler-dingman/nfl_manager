import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  AccessibilityInfo,
  AppState,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createKlipyProvider } from '../../../packages/gifs/klipy';
import { GIF_CHIPS, type GifItem, type GifReference } from '../../../packages/gifs';
import { createUseGifPicker } from '../../../packages/gifs/use-picker';
export const gifProvider = createKlipyProvider(process.env.EXPO_PUBLIC_KLIPY_APP_KEY);
const usePicker = createUseGifPicker({ useCallback, useEffect, useRef, useState });
export function GifPicker({
  onClose,
  onSelect,
  accent,
}: {
  onClose: () => void;
  onSelect: (gif: GifItem, query: string) => void;
  accent: string;
}) {
  const p = usePicker(gifProvider),
    insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={{ flex: 1 }} accessibilityLabel="Close GIF picker" onPress={onClose} />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12), maxHeight: '88%' }]}
          accessibilityViewIsModal
        >
          <View style={s.header}>
            <Text style={s.brand}>KLIPY</Text>
            <Pressable
              onPress={() => void Linking.openURL('https://klipy.com')}
              accessibilityRole="link"
              style={{ marginLeft: 'auto' }}
            >
              <Text style={s.small}>Powered by KLIPY ↗</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close GIF picker"
              onPress={onClose}
              style={s.icon}
            >
              <Ionicons name="close" color="white" size={24} />
            </Pressable>
          </View>
          <View style={s.search}>
            <Ionicons name="search" color="#afc4cd" size={22} />
            <TextInput
              accessibilityLabel="Search GIFs"
              placeholder="Search KLIPY"
              placeholderTextColor="#9db2bd"
              value={p.query}
              onChangeText={p.setQuery}
              maxLength={120}
              style={s.input}
              autoCorrect={false}
            />
            {!!p.query && (
              <Pressable
                accessibilityLabel="Clear GIF search"
                onPress={() => p.setQuery('')}
                style={s.icon}
              >
                <Ionicons name="close-circle" color="#afc4cd" size={20} />
              </Pressable>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GIF_CHIPS.map(([label, q]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: p.query === q }}
                  style={[s.chip, p.query === q && { backgroundColor: accent }]}
                  onPress={() => p.setQuery(q)}
                >
                  <Text style={s.text}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {!!p.error && (
            <View style={s.state}>
              <Text style={s.text}>{p.error}</Text>
              <Pressable onPress={p.retry} style={s.chip}>
                <Text style={s.text}>Try again</Text>
              </Pressable>
            </View>
          )}
          {p.busy && (
            <Text accessibilityLiveRegion="polite" style={s.small}>
              Loading GIFs…
            </Text>
          )}
          {!p.busy && !p.error && !p.items.length && (
            <Text style={s.text}>No GIFs found{p.query ? ` for “${p.query}”` : ''}.</Text>
          )}
          <FlatList
            data={p.items}
            numColumns={2}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={8}
            windowSize={3}
            keyExtractor={(g, i) => `${g.id}-${i}`}
            columnWrapperStyle={{ gap: 10 }}
            style={{ minHeight: 180 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
            renderItem={({ item }) => (
              <Pressable
                style={s.tile}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.title}`}
                onPress={() => onSelect(item, p.query)}
              >
                <Image
                  source={{ uri: item.stillUrl }}
                  style={{ width: '100%', aspectRatio: item.aspectRatio }}
                  contentFit="contain"
                  cachePolicy="none"
                  accessibilityLabel={item.title}
                />
                <Text style={s.small}>{item.attribution}</Text>
              </Pressable>
            )}
            ListFooterComponent={
              p.cursor ? (
                <Pressable disabled={p.busy} style={s.chip} onPress={p.more}>
                  <Text style={s.text}>Load more GIFs</Text>
                </Pressable>
              ) : null
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
/** Native chat uses an explicit play control; no offscreen animation or decoding by default. */
export function PostedGif({ media, resolved, pauseVersion }: { media: GifReference; resolved?: GifItem; pauseVersion?: number }) {
  const [gif, setGif] = useState(resolved),
    [failed, setFailed] = useState(false),
    [play, setPlay] = useState(false);
  useEffect(() => setPlay(false), [pauseVersion]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => setPlay(false));
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', () => setPlay(false));
    return () => {
      sub.remove();
      rm.remove();
    };
  }, []);
  useEffect(() => {
    if (resolved) {
      setGif(resolved);
      return;
    }
    const c = new AbortController();
    gifProvider
      .getById(media.providerMediaId, c.signal)
      .then((g) => {
        if (!c.signal.aborted) {
          setGif(g ?? undefined);
          setFailed(!g);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setFailed(true);
      });
    return () => c.abort();
  }, [media.providerMediaId, resolved]);
  return (
    <View style={{ maxWidth: 400, width: '100%', marginTop: 8 }}>
      {gif && !failed ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={play ? 'Pause GIF' : 'Play GIF'}
            onPress={() => setPlay(!play)}
          >
            <Image
              source={{ uri: play ? gif.mediaUrl : gif.stillUrl }}
              style={{ width: '100%', aspectRatio: gif.aspectRatio, borderRadius: 8 }}
              contentFit="contain"
              cachePolicy="none"
              onError={() => setFailed(true)}
            />
            <Text
              style={[
                s.small,
                {
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  backgroundColor: '#001016dd',
                  padding: 4,
                },
              ]}
            >
              {play ? 'Pause GIF' : 'Play GIF'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(gif.providerUrl)}>
            <Text style={s.small}>{gif.attribution}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={s.small}>{failed ? 'GIF unavailable' : 'Loading GIF…'}</Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00101699' },
  sheet: {
    backgroundColor: '#03151d',
    borderColor: '#42606b',
    borderWidth: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  brand: { fontSize: 24, fontWeight: '700', color: 'white', letterSpacing: 2 },
  small: { fontFamily: 'BarlowCondensedRegular', fontSize: 12, color: '#afc4cd' },
  text: { fontFamily: 'BarlowCondensedRegular', fontSize: 17, color: 'white' },
  icon: { padding: 8, minHeight: 44, justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#42606b',
    borderRadius: 28,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    fontFamily: 'BarlowCondensedRegular',
    fontSize: 20,
    color: 'white',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#0a202a',
  },
  tile: {
    flex: 1,
    maxWidth: '49%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0a202a',
  },
  state: { padding: 12, gap: 10 },
});
