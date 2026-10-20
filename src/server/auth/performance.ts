import { AsyncLocalStorage } from 'node:async_hooks';
export type AuthStage =
  | 'jwt.signature'
  | 'jwt.public_key'
  | 'jwt.key_fetch'
  | 'jwt.claims'
  | 'provider.lookup'
  | 'd1.revocation'
  | 'd1.provision'
  | 'session.create'
  | 'session.lookup'
  | 'session.sign'
  | 'session.encrypt'
  | 'ssr.authentication'
  | 'json.serialization'
  | 'request.parse'
  | 'middleware';
export interface AuthTiming {
  stage: AuthStage;
  elapsedMs: number;
  ok: boolean;
  localNodeCpuMs?: number;
}
type TimingScope = { timings: AuthTiming[]; cpuSample?: () => number };
const symbol = Symbol.for('down-distance.auth-timings');
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
const context = (globals[symbol] ??=
  new AsyncLocalStorage<TimingScope>()) as AsyncLocalStorage<TimingScope>;
/** Request-local numeric timings only. Elapsed time includes I/O; it is NEVER Worker CPU. */
export const withAuthTimings = <T>(timings: AuthTiming[], run: () => T, cpuSample?: () => number) =>
  context.run({ timings, cpuSample }, run);
export async function authStage<T>(stage: AuthStage, operation: () => T | Promise<T>): Promise<T> {
  const scope = context.getStore();
  const timings = scope?.timings;
  if (!timings) return operation();
  const start = performance.now(),
    cpuStart = scope?.cpuSample?.();
  let ok = false;
  try {
    const result = await operation();
    ok = true;
    return result;
  } finally {
    if (timings.length < 96)
      timings.push({
        stage,
        elapsedMs: Math.max(0, performance.now() - start),
        ok,
        ...(cpuStart === undefined
          ? {}
          : { localNodeCpuMs: Math.max(0, scope!.cpuSample!() - cpuStart) }),
      });
  }
}
export function authStageSync<T>(stage: AuthStage, operation: () => T): T {
  const scope = context.getStore();
  const timings = scope?.timings;
  if (!timings) return operation();
  const start = performance.now(),
    cpuStart = scope?.cpuSample?.();
  let ok = false;
  try {
    const result = operation();
    ok = true;
    return result;
  } finally {
    if (timings.length < 96)
      timings.push({
        stage,
        elapsedMs: Math.max(0, performance.now() - start),
        ok,
        ...(cpuStart === undefined
          ? {}
          : { localNodeCpuMs: Math.max(0, scope!.cpuSample!() - cpuStart) }),
      });
  }
}
