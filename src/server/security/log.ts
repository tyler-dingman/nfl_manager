export function logSecurityEvent(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}