import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
/** Native persistence with a browser adapter for the Expo development preview. */
export const deviceStorage = {
  async remove(key: string) {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
  async get(key: string) {
    return Platform.OS === 'web'
      ? (globalThis.localStorage?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
};
