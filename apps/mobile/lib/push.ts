import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authenticatedFetch } from './auth';

const INSTALLATION = 'dd.mobile.installation',
  DEVICE_ID = 'dd.mobile.push.device';
export type PushState = 'enabled' | 'disabled' | 'denied' | 'unavailable';
async function secureId(key: string) {
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(key, created);
  return created;
}
async function jsonRequest(path: string, init?: RequestInit) {
  const response = await authenticatedFetch(path, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'Push setup failed.');
  return body;
}
export async function getPushState(): Promise<PushState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  const [permission, preference] = await Promise.all([
    Notifications.getPermissionsAsync(),
    jsonRequest('/api/user/preferences'),
  ]);
  if (permission.status === 'denied') {
    await disablePush().catch(() => undefined);
    return 'denied';
  }
  return preference.preferences?.pushEnabled && permission.status === 'granted'
    ? 'enabled'
    : 'disabled';
}
export async function enablePush({
  requestPermission = true,
}: { requestPermission?: boolean } = {}) {
  if (Platform.OS === 'web' || !Device.isDevice)
    throw new Error('Push notifications require a physical device.');
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error(
      permission.canAskAgain
        ? 'Notification permission was not granted.'
        : 'Permission denied. Re-enable notifications in iPhone Settings.',
    );
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID is required for push tokens.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const device = await jsonRequest('/api/user/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      installationId: await secureId(INSTALLATION),
      deviceName: Device.deviceName,
      appVersion: Constants.expoConfig?.version,
      osVersion: Device.osVersion,
    }),
  });
  await jsonRequest('/api/user/devices/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: device.device.id, provider: 'EXPO', token }),
  });
  await jsonRequest('/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pushEnabled: true }),
  });
  await SecureStore.setItemAsync(DEVICE_ID, device.device.id);
  return 'enabled' as const;
}
export async function disablePush() {
  const deviceId = await SecureStore.getItemAsync(DEVICE_ID);
  if (deviceId)
    await jsonRequest('/api/user/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
  await jsonRequest('/api/user/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pushEnabled: false }),
  });
  return 'disabled' as const;
}
export async function syncPushRegistration() {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const preference = await jsonRequest('/api/user/preferences');
  if (preference.preferences?.pushEnabled) await enablePush({ requestPermission: false });
}
export async function sendTestPush() {
  return jsonRequest('/api/push/test', { method: 'POST' });
}
export function notificationDestination(response: Notifications.NotificationResponse | null) {
  const value = response?.notification.request.content.data?.destination;
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  if (value.startsWith('/the-beat')) {
    const id = new URL(value, 'https://downanddistance.local').searchParams.get('story');
    return id ? `/beat-story/${id}` : '/beat';
  }
  if (value.startsWith('/watch')) return '/film-room';
  if (value.startsWith('/crew')) return '/crew';
  if (value.startsWith('/game-day')) return '/game-day';
  if (value.startsWith('/trivia')) return '/trivia';
  if (value.startsWith('/front-office')) return '/front-office';
  return value;
}
