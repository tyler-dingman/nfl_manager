import { Storage } from './core';
import { encryptSecret, tokenHash } from '../../src/server/auth/crypto';
import type { WebSubscription } from '../../src/server/notifications/web-push';
export class D1WebPush {
  constructor(readonly s: Storage) {}
  async saveWebSubscription(user: string, subscription: WebSubscription) {
    const hash = tokenHash(subscription.endpoint),
      now = Date.now();
    const results = await this.s.batch([
      this.s.statement(
        "INSERT INTO app_devices(id,user_id,platform,name,installation_id,last_seen_at) VALUES(?,?,'WEB','Web browser',?,?) ON CONFLICT(user_id,installation_id) WHERE installation_id IS NOT NULL DO UPDATE SET disabled_at=NULL,last_seen_at=excluded.last_seen_at",
        [crypto.randomUUID(), user, 'web:' + hash, now],
      ),
      this.s.statement(
        "INSERT INTO app_push_tokens(id,user_id,device_id,provider,token_hash,token_ciphertext,web_endpoint_hash,last_validated_at,created_at) SELECT ?,?,id,'WEB_PUSH',?,?,?,?,? FROM app_devices WHERE user_id=? AND installation_id=? ON CONFLICT(web_endpoint_hash) WHERE web_endpoint_hash IS NOT NULL DO UPDATE SET user_id=excluded.user_id,device_id=excluded.device_id,token_ciphertext=excluded.token_ciphertext,invalidated_at=NULL,last_validated_at=excluded.last_validated_at RETURNING id",
        [
          crypto.randomUUID(),
          user,
          hash,
          encryptSecret(JSON.stringify(subscription)),
          hash,
          now,
          now,
          user,
          'web:' + hash,
        ],
      ),
    ]);
    return results[1].results[0] as { id: string };
  }
  async deleteWebSubscription(user: string, hash: string) {
    await this.s
      .statement(
        "DELETE FROM app_push_tokens WHERE user_id=? AND provider='WEB_PUSH' AND web_endpoint_hash=?",
        [user, hash],
      )
      .run();
  }
  async deleteWebPushToken(user: string, id: string) {
    await this.s
      .statement("DELETE FROM app_push_tokens WHERE user_id=? AND id=? AND provider='WEB_PUSH'", [
        user,
        id,
      ])
      .run();
  }
  async claimWebPushTest(user: string) {
    return (
      (
        await this.s.rows(
          'INSERT INTO app_web_push_test_limits(user_id,attempted_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET attempted_at=excluded.attempted_at WHERE attempted_at<? RETURNING user_id',
          [user, Date.now(), Date.now() - 30000],
        )
      ).length > 0
    );
  }
}
