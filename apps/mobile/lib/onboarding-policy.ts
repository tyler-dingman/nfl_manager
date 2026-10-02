/** Existing profile cursor is reused: Team=1, Value=2, Delivery=3, Time=4, Confirm=5. */
export const isLegacyAccount = (createdAt?: string) =>
  !!createdAt && Date.parse(createdAt) < Date.parse('2026-09-28T00:00:00Z');
export function onboardingEntry(input: {
  completed: boolean;
  step: number;
  team: string | null;
  createdAt?: string;
  hasDeliveryRecord: boolean;
}) {
  if (!input.team) return 1;
  if (input.completed) return 0;
  // Fixed rollout boundary avoids treating an interrupted new flow as a legacy account later.
  const legacy = isLegacyAccount(input.createdAt);
  if (legacy && input.step <= 1) return input.hasDeliveryRecord ? 0 : 3;
  return Math.max(2, Math.min(5, input.step));
}
