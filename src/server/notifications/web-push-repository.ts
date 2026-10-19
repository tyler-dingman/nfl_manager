import{applicationBackend,applicationStorage}from'../persistence/bindings';
import{D1WebPush}from'../../../packages/storage/web-push';
import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import { encryptSecret, tokenHash } from '@/server/auth/crypto';
import type { WebSubscription } from './web-push';

export async function saveWebSubscription(userId: string, subscription: WebSubscription) {
  if(applicationBackend()==='d1') return new D1WebPush(applicationStorage('D1_USERS')).saveWebSubscription(userId,subscription);

  const endpointHash = tokenHash(subscription.endpoint);
  return authDb().begin(async (tx) => {
    const [device] = await tx<Array<{ id: string }>>`
      INSERT INTO user_devices(id,user_id,platform,device_name,installation_id,last_seen_at)
      VALUES(${randomUUID()},${userId},'WEB','Web browser',${`web:${endpointHash}`},now())
      ON CONFLICT (user_id,installation_id) WHERE installation_id IS NOT NULL
      DO UPDATE SET disabled_at=NULL,last_seen_at=now(),updated_at=now() RETURNING id`;
    const [token] = await tx<Array<{ id: string }>>`
      INSERT INTO user_push_tokens(id,user_id,device_id,provider,token_hash,token_ciphertext,web_endpoint_hash,last_validated_at)
      VALUES(${randomUUID()},${userId},${device.id},'WEB_PUSH',${endpointHash},${encryptSecret(JSON.stringify(subscription))},${endpointHash},now())
      ON CONFLICT (web_endpoint_hash) WHERE web_endpoint_hash IS NOT NULL
      DO UPDATE SET user_id=EXCLUDED.user_id,device_id=EXCLUDED.device_id,token_ciphertext=EXCLUDED.token_ciphertext,
        invalidated_at=NULL,last_validated_at=now(),updated_at=now() RETURNING id`;
    return token;
  });
}

export async function deleteWebSubscription(userId: string, endpointHash: string) {
  if(applicationBackend()==='d1') return new D1WebPush(applicationStorage('D1_USERS')).deleteWebSubscription(userId,endpointHash);

  await authDb()`DELETE FROM user_push_tokens WHERE user_id=${userId} AND provider='WEB_PUSH' AND web_endpoint_hash=${endpointHash}`;
}

export async function deleteWebPushToken(userId: string, id: string) {
  if(applicationBackend()==='d1') return new D1WebPush(applicationStorage('D1_USERS')).deleteWebPushToken(userId,id);

  await authDb()`DELETE FROM user_push_tokens WHERE user_id=${userId} AND id=${id} AND provider='WEB_PUSH'`;
}

export async function claimWebPushTest(userId: string) {
  if(applicationBackend()==='d1') return new D1WebPush(applicationStorage('D1_USERS')).claimWebPushTest(userId);

  const rows =
    await authDb()`INSERT INTO web_push_test_limits(user_id,attempted_at) VALUES(${userId},now())
    ON CONFLICT(user_id) DO UPDATE SET attempted_at=now()
    WHERE web_push_test_limits.attempted_at < now() - interval '30 seconds' RETURNING user_id`;
  return rows.length > 0;
}
