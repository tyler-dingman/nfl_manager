import { applicationPasswordService, passwordRuntimeAvailable } from '../persistence/bindings';
async function request(operation: 'hash' | 'verify', password: string, encoded?: string) {
  if (!passwordRuntimeAvailable()) throw Error('Password service is not enabled');
  const response = await applicationPasswordService().fetch(
    new Request('https://internal/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation, password, encoded }),
    }),
  );
  if (!response.ok) throw Error('Password service is temporarily unavailable');
  const value = (await response.json()) as { result: unknown };
  if (
    operation === 'hash'
      ? typeof value.result !== 'string' ||
        !value.result.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')
      : typeof value.result !== 'boolean'
  )
    throw Error('Invalid password service response');
  return value.result;
}
export async function hash(password: string, _options?: unknown): Promise<string> {
  return (await request('hash', password)) as string;
}
export async function verify(encoded: string, password: string): Promise<boolean> {
  return (await request('verify', password, encoded)) as boolean;
}
