/** Explicit unavailable capability, never a hash replacement or bypass. */
export async function hash(): Promise<string> {
  throw Error('Password hashing is not qualified for Free Workers.');
}
export async function verify(): Promise<boolean> {
  throw Error('Password verification is not qualified for Free Workers.');
}
