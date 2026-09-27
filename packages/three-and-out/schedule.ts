export const DEFAULT_DELIVERY_TIME = '07:00';
export const DELIVERY_PRESETS = [
  { id: 'morning', label: 'Morning', time: '07:00', detail: '7:00 AM' },
  { id: 'midday', label: 'Midday', time: '12:00', detail: '12:00 PM' },
  { id: 'evening', label: 'Evening', time: '18:00', detail: '6:00 PM' },
  { id: 'custom', label: 'Custom', time: '', detail: 'Choose a time' },
] as const;
export function validDeliveryTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
export function timezoneLabel(timeZone: string) {
  return (
    new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  );
}
