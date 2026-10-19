import * as pg from './repository-postgres';
import { D1Notifications } from '../../../packages/storage/notifications';
import { applicationBackend, applicationStorage } from '../persistence/bindings';
export type { NotificationCategory } from './repository-postgres';
function dispatch<K extends keyof typeof pg>(name: K): (typeof pg)[K] {
  return (async (...args: unknown[]) => {
    if (applicationBackend() === 'postgres') return (pg[name] as Function)(...args);
    const repo = new D1Notifications(applicationStorage());
    const method = (repo as any)[name];
    if (!method) throw Error('D1 notification operation unavailable: ' + name);
    return method.apply(repo, args);
  }) as (typeof pg)[K];
}
export const registerDevice = dispatch('registerDevice');
export const listDevices = dispatch('listDevices');
export const removeDevice = dispatch('removeDevice');
export const upsertPushToken = dispatch('upsertPushToken');
export const invalidatePushToken = dispatch('invalidatePushToken');
export const listPushTokens = dispatch('listPushTokens');
export const listDeliverablePushTokens = dispatch('listDeliverablePushTokens');
export const getNotificationPreferences = dispatch('getNotificationPreferences');
export const getDeliveryReadiness = dispatch('getDeliveryReadiness');
export const updateNotificationPreferences = dispatch('updateNotificationPreferences');
export const addPhoneNumber = dispatch('addPhoneNumber');
export const verifyPhoneNumber = dispatch('verifyPhoneNumber');
export const removePhoneNumber = dispatch('removePhoneNumber');
export const grantConsent = dispatch('grantConsent');
export const revokeConsent = dispatch('revokeConsent');
export const listInbox = dispatch('listInbox');
export const unreadNotificationCount = dispatch('unreadNotificationCount');
export const markNotificationsSeen = dispatch('markNotificationsSeen');
export const markNotificationRead = dispatch('markNotificationRead');
export const markAllNotificationsRead = dispatch('markAllNotificationsRead');
export const dismissNotification = dispatch('dismissNotification');
export const createNotification = dispatch('createNotification');
export const recordDelivery = dispatch('recordDelivery');
export const finishPushDelivery = dispatch('finishPushDelivery');
