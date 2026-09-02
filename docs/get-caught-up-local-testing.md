# Get Caught Up local testing

Run `npm run auth:migrate`, sign in, and select a team. A first visit establishes a server-side baseline and intentionally shows no catch-up module. A new visit begins after 30 minutes of inactivity; refreshing inside that window does not count as another visit.

Development-only homepage fixtures avoid the wait:

- `/?catchUpDemo=first` — first-visit hidden state
- `/?catchUpDemo=none` — returning user with no meaningful changes
- `/?catchUpDemo=one` — one changed story
- `/?catchUpDemo=multiple` — three ranked changes
- `/?catchUpDemo=resolved` — one resolved story

Select a team before using a fixture. Open the briefing through its CTA and use **Mark me caught up** to advance the real team-aware baseline. Production ignores all demo query parameters.
