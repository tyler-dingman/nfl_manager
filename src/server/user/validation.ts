import { z } from 'zod';
import { INTENSITIES, LANDING_EXPERIENCES } from './types';
export const teamIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(8)
  .transform((v) => v.toUpperCase());
export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  timezone: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(20).optional(),
});
export const preferencesSchema = z
  .object({
    preferredTeamId: teamIdSchema.optional(),
    audioPlaybackSpeed: z
      .union([z.literal(0.75), z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)])
      .optional(),
    autoplayVideo: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    showAroundLeague: z.boolean().optional(),
    preferredLandingExperience: z.enum(LANDING_EXPERIENCES).optional(),
    pushEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    showPollResultsBeforeVoting: z.boolean().optional(),
    predictionVisibility: z.enum(['PRIVATE', 'FRIENDS', 'PUBLIC']).optional(),
    intensity: z.enum(INTENSITIES).optional(),
    advancedNotifications: z.record(z.string(), z.boolean()).optional(),
  })
  .strict();
