import { z } from 'zod';
// Verified against https://data.unabated.com/swagger/v1/swagger.json (2026-10-09).
// Unknown fields are stripped; missing optional provider fields remain missing.
const id = z.number().int().safe().nonnegative();
const optionalId = id.nullish();
const text = z.string().nullish();
const number = z.number().finite().nullish();
const lineFields = {
  marketId: optionalId,
  marketLineId: optionalId,
  marketSourceId: optionalId,
  points: number,
  price: z.number().int().nullish(),
  statusId: z.number().int(),
  disabled: z.boolean().optional(),
  deepLink: text,
  modifiedOn: text,
  freshnessExpiresAt: text,
  sequenceNumber: optionalId,
  partnerOddsData: z
    .object({ fanduel: z.object({ marketId: text, selectionId: text }).nullish() })
    .nullish(),
};
export const lineSchema = z.object({
  ...lineFields,
  alternateLines: z.array(z.object(lineFields)).nullish(),
});
export const groupSchema = z.object({
  eventId: optionalId,
  eventName: text,
  eventStart: text,
  statusId: z.number().int(),
  isLive: z.boolean(),
  betTypeId: id,
  betSubType: text,
  sides: z
    .record(
      z.string(),
      z.object({
        sideIndex: z.number().int(),
        sideName: text,
        personId: optionalId,
        teamId: optionalId,
        marketSourceLines: z.record(z.string(), lineSchema).nullish(),
      }),
    )
    .nullish(),
});
type OddsGroup = z.infer<typeof groupSchema>;
export type UnabatedOdds = {
  lastUpdated: number;
  odds?: Record<
    string,
    {
      leagueId: number;
      periodTypes?: Record<
        string,
        {
          periodTypeId: number;
          pregame?: Record<string, OddsGroup> | null;
          live?: Record<string, OddsGroup> | null;
        }
      > | null;
    }
  > | null;
};
export const oddsSchema: z.ZodType<UnabatedOdds> = z.object({
  lastUpdated: id,
  odds: z
    .record(
      z.string(),
      z.object({
        leagueId: id,
        periodTypes: z
          .record(
            z.string(),
            z.object({
              periodTypeId: id,
              pregame: z.record(z.string(), groupSchema).nullish(),
              live: z.record(z.string(), groupSchema).nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});
export const leagueSchema = z.array(z.object({ id, name: z.string(), fullName: text }));
export const sourceSchema = z.array(
  z.object({
    id,
    name: z.string(),
    isActive: z.boolean(),
    statusId: z.number().int(),
    propsStatusId: z.number().int(),
    disabledMarketTypeIds: z.array(z.number().int()).nullish(),
  }),
);
export const betTypeSchema = z.array(
  z.object({
    id,
    name: z.string(),
    description: text,
    hasPoints: z.boolean(),
    active: z.boolean(),
    sides: text,
  }),
);
export const periodSchema = z.array(z.object({ id, name: z.string(), abbreviation: text }));
export const peopleSchema = z.record(
  z.string(),
  z.object({
    id,
    firstName: text,
    lastName: text,
    preferredName: text,
    teamId: optionalId,
    position: text,
  }),
);
export const teamsSchema = z.record(z.string(), z.object({ id, name: text, abbreviation: text }));
export const deepLinkSchema = z.object({
  ids: z.array(id).nullish(),
  url: text,
  status: z.number().int(),
  statusString: text,
  individualUrls: z.array(z.string()).nullish(),
});
export type UnabatedLine = z.infer<typeof lineSchema>;

export const generatedBetSchema = z.object({
  id: z.string().nullish(),
  player: z.string().nullish(),
  event: z.string().nullish(),
  betType: z.string().nullish(),
  periodType: z.string().nullish(),
  isLive: z.boolean(),
  odds: z.object({ points: z.string().nullish(), value: z.string().nullish() }).nullish(),
  direction: z.string().nullish(),
  side: z.string().nullish(),
  deepLink: z.object({ sportsbook: z.string().nullish(), url: z.string().nullish() }).nullish(),
  metadata: z
    .object({
      league: z.string().nullish(),
      timestamp: z.string().nullish(),
      additionalInfo: z.record(z.string(), z.unknown()).nullish(),
    })
    .nullish(),
});
export const generatedSlipSchema = z.object({
  book: z.string(),
  deepLink: z.string().nullish(),
  legsRequested: z.number().int(),
  legsMatched: z.number().int(),
  betslipBets: z.array(generatedBetSchema).nullish(),
});
export const generationSchema = z.object({
  status: z.string(),
  requestId: z.string().uuid().optional(),
  betSlips: z.array(generatedSlipSchema).optional(),
});
export type GeneratedSlip = z.infer<typeof generatedSlipSchema>;
