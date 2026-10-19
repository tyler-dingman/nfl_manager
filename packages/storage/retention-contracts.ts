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
    deletion:
      '90 days after latest meaningful update; saved/externally referenced articles and all their corrections retained; verified encrypted offline archive required before owner cleanup',
  },
  drafts: {
    class: 'TEMPORARY',
    deletion:
      '7 days after last eligibility update; never treat a formerly published article as a 7-day draft',
  },
  threeAndOut: {
    class: 'REFERENCED_HISTORY',
    deletion: '30 days online unless saved/referenced; verified owner archive required',
  },
  oddsHistory: {
    class: 'REFERENCED_HISTORY',
    deletion:
      '30 days general history; permanent saved market/event evidence and original identities retained; verified owner archive required',
  },
  sourceEvidence: {
    class: 'REFERENCED_HISTORY',
    deletion:
      '7 days after completed processing only if unreferenced; retain evidence/attribution required by retained articles; compact identity receipt prevents re-ingestion',
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
