import { authenticatedFetch } from './auth';
export type Delivery = {
  enabled: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
  deliveryTime: string;
  timezone: string | null;
  accountEmail?: string;
  emailAvailable?: boolean;
  hasVerifiedPhone?: boolean;
  hasPushDevice?: boolean;
  smsDeliveryPending?: boolean;
};
export async function onboardingRequest(path: string, method = 'GET', body?: unknown) {
  const response = await authenticatedFetch(path, {
    method,
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? 'Unable to save. Check your connection and retry.');
  return data;
}
export const saveOnboardingStep = (step: number, completed = false) =>
  onboardingRequest('/api/user/onboarding', 'PATCH', { step, completed });
export async function saveDelivery(value: Delivery) {
  return (
    await onboardingRequest('/api/three-and-out/preferences', 'PUT', {
      enabled: value.enabled,
      email: value.email,
      sms: value.sms,
      push: value.push,
      deliveryTime: value.deliveryTime,
      timezone: value.timezone,
    })
  ).preferences as Delivery;
}
