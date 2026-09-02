import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import { secureToken, tokenHash } from '@/server/auth/crypto';

export async function ensureUserSettings(userId: string) {
  await authDb()`INSERT INTO user_profiles (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
  await authDb()`INSERT INTO user_preferences (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
}
export async function getProfile(userId: string) {
  await ensureUserSettings(userId);
  const rows = await authDb()<
    Array<Record<string, unknown>>
  >`SELECT u.id, u.display_name AS "displayName", u.first_name AS "firstName", u.last_name AS "lastName", u.primary_email AS "primaryEmail", u.email_verified AS "emailVerified", u.avatar_url AS "avatarUrl", p.timezone, p.locale, p.onboarding_completed AS "onboardingCompleted", p.onboarding_step AS "onboardingStep", u.created_at AS "createdAt", greatest(u.updated_at,p.updated_at) AS "updatedAt" FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${userId}`;
  return rows[0];
}
export async function updateProfile(
  userId: string,
  input: {
    displayName?: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    timezone?: string;
    locale?: string;
  },
) {
  await ensureUserSettings(userId);
  const sql = authDb();
  await sql.begin(async (tx) => {
    await tx`UPDATE users SET display_name=coalesce(${input.displayName ?? null},display_name), first_name=CASE WHEN ${input.firstName === undefined} THEN first_name ELSE ${input.firstName ?? null} END, last_name=CASE WHEN ${input.lastName === undefined} THEN last_name ELSE ${input.lastName ?? null} END, avatar_url=CASE WHEN ${input.avatarUrl === undefined} THEN avatar_url ELSE ${input.avatarUrl ?? null} END, updated_at=now() WHERE id=${userId}`;
    await tx`UPDATE user_profiles SET timezone=coalesce(${input.timezone ?? null},timezone), locale=coalesce(${input.locale ?? null},locale), updated_at=now() WHERE user_id=${userId}`;
  });
  return getProfile(userId);
}
export async function getPreferences(userId: string) {
  await ensureUserSettings(userId);
  const rows = await authDb()<
    Array<Record<string, unknown>>
  >`SELECT favorite_team_abbr AS "preferredTeamId", audio_playback_speed::float AS "audioPlaybackSpeed", autoplay_video AS "autoplayVideo", reduced_motion AS "reducedMotion", show_around_league AS "showAroundLeague", preferred_landing_experience AS "preferredLandingExperience", push_enabled AS "pushEnabled", sms_enabled AS "smsEnabled", email_enabled AS "emailEnabled", show_poll_results_before_voting AS "showPollResultsBeforeVoting", prediction_visibility AS "predictionVisibility", intensity, advanced_notifications AS "advancedNotifications" FROM user_preferences WHERE user_id=${userId}`;
  return rows[0];
}
export async function updatePreferences(userId: string, input: Record<string, unknown>) {
  await ensureUserSettings(userId);
  const sql = authDb();
  const advanced = input.advancedNotifications
    ? sql.json(input.advancedNotifications as Record<string, boolean>)
    : null;
  await sql`UPDATE user_preferences SET favorite_team_abbr=coalesce(${(input.preferredTeamId as string) ?? null},favorite_team_abbr), audio_playback_speed=coalesce(${(input.audioPlaybackSpeed as number) ?? null},audio_playback_speed), autoplay_video=coalesce(${(input.autoplayVideo as boolean) ?? null},autoplay_video), reduced_motion=coalesce(${(input.reducedMotion as boolean) ?? null},reduced_motion), show_around_league=coalesce(${(input.showAroundLeague as boolean) ?? null},show_around_league), preferred_landing_experience=coalesce(${(input.preferredLandingExperience as string) ?? null},preferred_landing_experience), push_enabled=coalesce(${(input.pushEnabled as boolean) ?? null},push_enabled), sms_enabled=coalesce(${(input.smsEnabled as boolean) ?? null},sms_enabled), email_enabled=coalesce(${(input.emailEnabled as boolean) ?? null},email_enabled), show_poll_results_before_voting=coalesce(${(input.showPollResultsBeforeVoting as boolean) ?? null},show_poll_results_before_voting), prediction_visibility=coalesce(${(input.predictionVisibility as string) ?? null},prediction_visibility), intensity=coalesce(${(input.intensity as string) ?? null},intensity), advanced_notifications=coalesce(${advanced},advanced_notifications), updated_at=now() WHERE user_id=${userId}`;
  return getPreferences(userId);
}
export const listTeamFollows = (userId: string) =>
  authDb()`SELECT id,team_id AS "teamId",is_primary AS "isPrimary",notification_level AS "notificationLevel",created_at AS "createdAt" FROM user_team_follows WHERE user_id=${userId} ORDER BY is_primary DESC,created_at`;
export async function followTeam(userId: string, teamId: string, level = 'DEFAULT') {
  await authDb()`INSERT INTO user_team_follows(id,user_id,team_id,notification_level) VALUES(${randomUUID()},${userId},${teamId},${level}) ON CONFLICT(user_id,team_id) DO UPDATE SET notification_level=excluded.notification_level`;
  return listTeamFollows(userId);
}
export async function setPrimaryTeam(userId: string, teamId: string) {
  await ensureUserSettings(userId);
  await authDb().begin(async (tx) => {
    await tx`UPDATE user_team_follows SET is_primary=false WHERE user_id=${userId} AND is_primary`;
    await tx`INSERT INTO user_team_follows(id,user_id,team_id,is_primary) VALUES(${randomUUID()},${userId},${teamId},true) ON CONFLICT(user_id,team_id) DO UPDATE SET is_primary=true`;
    await tx`UPDATE user_preferences SET favorite_team_abbr=${teamId},updated_at=now() WHERE user_id=${userId}`;
  });
  return listTeamFollows(userId);
}
export async function unfollowTeam(userId: string, teamId: string) {
  await authDb()`DELETE FROM user_team_follows WHERE user_id=${userId} AND team_id=${teamId}`;
  await authDb()`UPDATE user_preferences SET favorite_team_abbr=null WHERE user_id=${userId} AND favorite_team_abbr=${teamId}`;
}
export async function getOnboarding(userId: string) {
  const profile = await getProfile(userId);
  return { completed: profile?.onboardingCompleted ?? false, step: profile?.onboardingStep ?? 1 };
}
export async function updateOnboarding(userId: string, step: number, completed: boolean) {
  await ensureUserSettings(userId);
  await authDb()`UPDATE user_profiles SET onboarding_step=${step},onboarding_completed=${completed},updated_at=now() WHERE user_id=${userId}`;
  return getOnboarding(userId);
}
export async function requestEmailChange(userId: string, newEmail: string) {
  const token = secureToken();
  await authDb()`UPDATE email_change_requests SET consumed_at=now() WHERE user_id=${userId} AND consumed_at IS NULL`;
  await authDb()`INSERT INTO email_change_requests(id,user_id,new_email,token_hash,expires_at) VALUES(${randomUUID()},${userId},${newEmail.toLowerCase()},${tokenHash(token)},now()+interval '30 minutes')`;
  return token;
}
export async function confirmEmailChange(token: string) {
  return authDb().begin(async (tx) => {
    const rows = await tx<
      Array<{ user_id: string; new_email: string }>
    >`UPDATE email_change_requests SET consumed_at=now() WHERE token_hash=${tokenHash(token)} AND consumed_at IS NULL AND expires_at>now() RETURNING user_id,new_email`;
    if (!rows[0]) throw new Error('This email-change link is invalid or expired.');
    await tx`UPDATE users SET primary_email=${rows[0].new_email},email_verified=true,updated_at=now() WHERE id=${rows[0].user_id}`;
    return rows[0].user_id;
  });
}
