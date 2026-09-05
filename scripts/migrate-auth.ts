import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';

async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });
  try {
    for (const file of [
      '001_auth_identity.sql',
      '002_user_profiles_and_preferences.sql',
      '003_notifications_and_devices.sql',
      '004_user_content_state.sql',
      '005_security_audit.sql',
      '006_remove_player_follows.sql',
      '007_trivia.sql',
      '008_trivia_gameplay_hardening.sql',
      '009_trivia_buddies.sql',
      '010_get_caught_up.sql',
      '011_move_the_chains_rewards.sql',
      '012_source_watcher_story_engine.sql',
      '013_story_downstream_projections.sql',
      '014_story_automation_policy.sql',
      '015_expo_push_delivery.sql',
      '016_game_day.sql',
      '017_search_documents.sql',
      '018_monitor_observer.sql',
      '019_story_corroboration.sql',
      '020_notification_center.sql',
      '021_crews.sql',
      '022_crew_share_recipients.sql',
      '023_commerce.sql',
      '024_stripe_webhooks.sql',
      '025_stripe_checkout_attempts.sql',
      '026_commerce_payment_hardening.sql',
      '027_content_automation_trial.sql',
    ]) {
      if (file === '017_search_documents.sql') {
        const [extension] = await sql<{ available: boolean }[]>`
          SELECT EXISTS (
            SELECT 1
            FROM pg_available_extensions
            WHERE name = 'vector'
          ) AS available
        `;

        if (!extension?.available) {
          console.warn(
            'Skipping 017_search_documents.sql because the optional pgvector extension is not available.',
          );
          continue;
        }
      }

      const migration = await readFile(path.join(process.cwd(), 'db/migrations', file), 'utf8');
      await sql.unsafe(migration);
    }
    console.log('Authentication and notification migrations applied.');
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
