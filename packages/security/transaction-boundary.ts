/** Dedicated server-to-Worker capability, never a browser/application route. */
export const TRANSACTION_PATH = '/__staging/transaction';
export const TRANSACTION_AUDIENCE = 'dd-native-d1-v1';
export function transactionConfiguration(env: Record<string, any>) {
  if (env.DD_TRANSACTION_BOUNDARY !== 'true') throw Error('Native transaction gateway disabled');
  const secret = env.DD_TRANSACTION_SECRET ?? '';
  if (
    secret.length < 64 ||
    [env.DD_NODE_ORIGIN_SECRET, env.AUTH_JWT_SECRET, env.STAGING_ACCESS_SECRET].includes(secret)
  )
    throw Error('Independent private transaction secret required');
  const publicOrigin = 'https://' + env.STAGING_ACCESS_HOST;
  if (publicOrigin !== 'https://down-distance-rc3-staging-web.tdingman5.workers.dev')
    throw Error('Only the existing staging gateway is permitted');
  return { secret, audience: TRANSACTION_AUDIENCE, publicOrigin };
}
