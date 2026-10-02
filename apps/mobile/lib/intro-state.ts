import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const KEY = 'dd.mobile.intro.complete.v1';
export async function hasCompletedIntro() {
  try { return (Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY)) === '1'; }
  catch { return false; }
}
export async function completeIntro() {
  try { if (Platform.OS === 'web') localStorage.setItem(KEY, '1'); else await SecureStore.setItemAsync(KEY, '1'); }
  catch { /* Storage failure must not block authentication. */ }
}
