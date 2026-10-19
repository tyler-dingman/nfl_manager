/** Explicit storage contracts. Age alone never authorizes deletion of valuable
 * records. SQL roots and transitive references/pins govern payload collection. */
export const RETENTION_CONTRACTS = {
  accounts: { class: 'PERMANENT', deletion: 'owner-authorized erasure only' },
  authentication: {
    class: 'PERMANENT',
    deletion:
      'consumed expired capabilities archived losslessly; accounts and session metadata retained',
  },
  preferences: { class: 'PERMANENT', deletion: 'none' },
  frontOffice: { class: 'PERMANENT', deletion: 'none; retain revisions and command receipts' },
  savedEvidence: { class: 'PERMANENT', deletion: 'none; retain ownership and evidence payloads' },
  editorial: {
    class: 'REFERENCED_HISTORY',
    deletion: 'none; retain all published versions, corrections, source attribution and IDs',
  },
  threeAndOut: {
    class: 'REFERENCED_HISTORY',
    deletion: 'none; dated briefing lookup remains supported',
  },
  oddsHistory: {
    class: 'REFERENCED_HISTORY',
    deletion: 'none; priceHistory consumes all original timestamps',
  },
  sourceEvidence: {
    class: 'REFERENCED_HISTORY',
    deletion: 'none; candidates, source provenance and editorial evidence remain rooted',
  },
  sportsbookTransfers: {
    class: 'PERMANENT',
    deletion: 'none; ownership, original IDs and idempotency remain intact',
  },
  labScores: {
    class: 'RECONSTRUCTABLE',
    deletion: 'only when board or reference version mismatches existing read contract',
  },
  aiResponses: {
    class: 'RECONSTRUCTABLE',
    deletion:
      'expires_at <= now and no active lease; remove directory only, GC checks payload references',
  },
  search: {
    class: 'RECONSTRUCTABLE',
    deletion: 'replace current projection transactionally on publication; do not drop live indexes',
  },
  temporaryObjects: {
    class: 'TEMPORARY',
    deletion: 'only verified unreferenced immutable objects under epoch fence',
  },
  processing: {
    class: 'TEMPORARY',
    deletion: 'lease expiration permits takeover, not deleting durable job/idempotency records',
  },
  operations: {
    class: 'REFERENCED_HISTORY',
    deletion:
      'retain usage/accounting/idempotency records until an explicit rollup/read contract exists',
  },
  community: {
    class: 'PERMANENT',
    deletion: 'retain Huddle/Crew ownership, messages, invitations, shares and original IDs',
  },
  triviaAndRewards: {
    class: 'PERMANENT',
    deletion: 'retain games, answers, outcomes, progress and reward/idempotency receipts',
  },
  commerce: {
    class: 'PERMANENT',
    deletion:
      'retain orders, inventory reservations, payment/webhook/fulfillment receipts and original IDs',
  },
  mediaProgress: { class: 'PERMANENT', deletion: 'retain user playback and prediction progress' },
  notificationAndConsent: {
    class: 'REFERENCED_HISTORY',
    deletion: 'retain consents, inbox, delivery receipts and device ownership; no new age policy',
  },
  referenceImports: {
    class: 'REFERENCED_HISTORY',
    deletion:
      'retain canonical schedules/statistics and reference/recovery identities; only unreferenced replaced payloads are GC candidates',
  },
  quotaAccounting: {
    class: 'PERMANENT',
    deletion: 'retain usage counters and idempotency keys; no unreviewed accounting reset',
  },
  catalogAndSettings: {
    class: 'PERMANENT',
    deletion: 'retain current authoritative catalog/configuration and owner settings',
  },
  legacyArchiveDirectories: {
    class: 'REFERENCED_HISTORY',
    deletion: 'retain rollback/history directories; missing archive payloads fail GC closed',
  },
  recovery: {
    class: 'REFERENCED_HISTORY',
    deletion:
      'pins and full reference graph retained; offline encrypted export includes all tables',
  },
} as const;
