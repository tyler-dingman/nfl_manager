# Canonical Story downstream surfaces

Phase 2 makes the Phase 1 canonical Story, StoryVersion, evidence, and domain-event records the shared source for every news surface.

```text
Source Watcher -> Canonical Story + evidence + versions + domain events
                              |
            +-----------------+------------------+
            |                 |                  |
         The Wire         The Huddle        Three and Out
            |                 |                  |
            +-----------------+------------------+
                              |
                         Get Caught Up
```

- **The Wire** answers what changed, chronologically. It derives one entry per meaningful story version from StoryCreated, StoryUpdated, StoryBecameBreaking, and StoryResolved. Extra source evidence does not create an entry.
- **The Huddle** answers what else matters. It selects four publishable, current, topic-diverse stories and normally excludes the current Three and Out IDs.
- **Three and Out** ranks canonical story IDs using the existing shared importance ranking and editorial override layer. Its immutable snapshot key contains story IDs and versions, so unchanged polling does not create a new snapshot.
- **Get Caught Up** stores the user/team baseline and compares it to canonical story IDs and material versions. It produces one NEW, CHANGED, or RESOLVED item per evolving story. Loading the homepage does not advance `last_caught_up_at`; completion does.

`isStoryPublishable` is the single public safety gate. Draft, review-required, low-confidence, unsourced, and holding stories are excluded before any surface selector runs. `StoryView` and its shared source projection give all surfaces the same original/official source ordering and URLs.

The aggregate `GET /api/content/homepage?team=KC` endpoint loads Huddle, Three and Out, and Wire data together. Rendering never invokes an AI model. Existing generated content remains a temporary fallback when a team has too few publishable canonical stories.

Editorial Three-and-Out overrides retain precedence over automated ranking. Migration 013 adds durable general story override storage for future admin UI support (`PUBLIC`, `HUDDLE`, and `THREE_AND_OUT`) and immutable snapshot history.

## Local verification

```bash
npm run auth:migrate
npm run surfaces:demo
npm run test:story-engine
npm run build
```

The deterministic demo starts with A/B/C in Three and Out and D/E/F/G in The Huddle, then makes D breaking and resolves A. No network or model is required.

## Phase 3 automation

Source scheduling uses one configurable tier map: `BREAKING` (3 minutes), `STANDARD` (10 minutes), and `LONG_FORM` (30 minutes). A registered source can retain its explicit interval override. `evaluatePublishingPolicy` is the only automation policy: official or strongly corroborated high-confidence factual updates may auto-publish; rumors, conflicts, uncertain clustering, and low-confidence synthesis require review; unsupported content is rejected.

A verified story with sufficient shared importance becomes `BREAKING` once. The existing idempotent `StoryBecameBreaking` event updates Phase 2 surfaces, while one deduplicated `BREAKING_STORY` notification candidate is recorded without sending push, email, or SMS. Active `HIDE`, `FORCE_REVIEW`, and `FORCE_PUBLISH` editorial overrides take precedence. Admins can inspect the minimal review queue at `GET /api/admin/story-reviews`.
