import { timingSafeEqual } from 'node:crypto';
import { createArgon2 } from './vendor/argon2.mjs';
export const PASSWORD_POLICY = {
  memorySize: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
} as const;
export function passwordEngine(modules: Record<string, WebAssembly.Module>) {
  const engine = createArgon2(modules);
  // One active operation bounds the memory-hard work; excess requests fail closed.
  let pending = 0,
    tail = Promise.resolve();
  const run = async <T>(fn: () => Promise<T>) => {
    if (pending >= 4) throw Error('Password worker busy');
    pending++;
    const prior = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await fn();
    } finally {
      pending--;
      release();
    }
  };
  return {
    hash: (password: string) =>
      run(() =>
        engine.argon2id({
          ...PASSWORD_POLICY,
          password,
          salt: crypto.getRandomValues(new Uint8Array(16)),
          outputType: 'encoded',
        }),
      ),
    verify: (encoded: string, password: string) =>
      run(async () => {
        const m =
          /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
            encoded,
          );
        if (!m) return false;
        const [memorySize, iterations, parallelism] = m.slice(1, 4).map(Number);
        // Honor stored parameters, including stronger legacy hashes. Never reinterpret.
        if (
          memorySize < 8 * parallelism ||
          memorySize > 65536 ||
          iterations < 1 ||
          iterations > 10 ||
          parallelism < 1 ||
          parallelism > 4
        )
          throw Error('Stored Argon2 parameters require the preserved Node verifier');
        const salt = Uint8Array.from(atob(m[4]), (c) => c.charCodeAt(0)),
          expected = Uint8Array.from(atob(m[5]), (c) => c.charCodeAt(0));
        if (salt.length < 8 || salt.length > 64 || expected.length < 16 || expected.length > 64)
          return false;
        const actual = await engine.argon2id({
          password,
          salt,
          memorySize,
          iterations,
          parallelism,
          hashLength: expected.length,
          outputType: 'binary',
        });
        return timingSafeEqual(actual, expected);
      }),
  };
}
